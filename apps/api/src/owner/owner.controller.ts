import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { MailService } from '../common/mail.service';
import { BillingService } from '../billing/billing.service';
import { AttendanceService } from '../attendance/attendance.service';
import { Access } from '../auth/guards';
import type { RequestCtx } from '../auth/guards';
import { Ctx } from '../common/decorators';
import { AppError, badRequest, conflict, notFound } from '../common/errors';
import { localDateS, nameS, emailS, timeMinutesS, uuidS } from '../common/schemas';
import { pinLookup, randomCode, randomPin, randomToken, sha256 } from '../common/crypto';
import { config } from '../common/config';
import { RangePreset, addDaysToLocalDate, isValidTimezone, localDateString, localToUtc, rangeFor } from '../attendance/engine';
import { csvLine, minutesToHHMM } from './csv';

const branchS = z.object({
  name: nameS,
  timezone: z.string().max(60).refine(isValidTimezone, 'Zona horaria no válida.'),
  punchMode: z.enum(['QR_ONLY', 'PIN_ONLY', 'QR_AND_PIN']),
  qrConfirmMode: z.enum(['AUTO', 'CONFIRM']),
  lateToleranceMinutes: z.number().int().min(0).max(120),
  earlyLeaveToleranceMin: z.number().int().min(0).max(120),
  minPunchGapSeconds: z.number().int().min(10).max(3600),
  maxOpenHours: z.number().int().min(4).max(48),
  active: z.boolean(),
});
const scheduleS = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6), isRest: z.boolean(), startMinutes: timeMinutesS, endMinutes: timeMinutesS,
})).max(7).refine((a) => new Set(a.map((x) => x.dayOfWeek)).size === a.length, 'Hay días repetidos en el horario.')
  .refine((a) => a.every((x) => x.isRest || x.startMinutes !== x.endMinutes), 'La hora de entrada y de salida no pueden ser iguales.');
const employeeCreateS = z.object({
  name: nameS, branchId: uuidS, employeeNumber: z.string().trim().min(1).max(30).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal('')), schedule: scheduleS.optional(),
});
const employeePatchS = z.object({
  name: nameS.optional(), branchId: uuidS.optional(), employeeNumber: z.string().trim().min(1).max(30).optional(),
  phone: z.string().trim().max(30).nullable().optional(), active: z.boolean().optional(),
});
const rangeQ = z.object({
  range: z.enum(['today', 'yesterday', 'week', 'fortnight', 'month']).optional(),
  from: localDateS.optional(), to: localDateS.optional(),
  employeeId: uuidS.optional(), branchId: uuidS.optional(),
  status: z.enum(['OPEN', 'CLOSED', 'INCOMPLETE']).optional(),
});

@Controller('app')
@Access('USER')
export class OwnerController {
  constructor(
    private prisma: PrismaService, private audit: AuditService, private billing: BillingService,
    private attendance: AttendanceService, private mail: MailService,
  ) {}

  // ───────── Negocio ─────────
  @Patch('tenant')
  @Access('USER', { writable: true })
  async updateTenant(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({ name: nameS }).parse(body);
    const t = await this.prisma.tenant.update({ where: { id: ctx.tenantId! }, data: { name: b.name } });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'tenant.update' });
    return { id: t.id, name: t.name };
  }

  // ───────── Sucursales ─────────
  @Get('branches')
  branches(@Ctx() ctx: RequestCtx) {
    return this.prisma.branch.findMany({ where: { tenantId: ctx.tenantId! }, orderBy: { createdAt: 'asc' } });
  }

  @Post('branches')
  @Access('USER', { writable: true })
  async createBranch(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = branchS.partial({ punchMode: true, qrConfirmMode: true, lateToleranceMinutes: true, earlyLeaveToleranceMin: true, minPunchGapSeconds: true, maxOpenHours: true, active: true, timezone: true }).parse(body);
    await this.billing.assertBranchLimit(ctx.tenantId!);
    const br = await this.prisma.branch.create({ data: { ...b, tenantId: ctx.tenantId! } });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'branch.create', entity: 'Branch', entityId: br.id });
    return br;
  }

  @Patch('branches/:id')
  @Access('USER', { writable: true })
  async updateBranch(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const b = branchS.partial().parse(body);
    const cur = await this.prisma.branch.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!cur) throw notFound();
    if (b.active === true && !cur.active) await this.billing.assertBranchLimit(ctx.tenantId!);
    if (b.active === false) {
      const others = await this.prisma.branch.count({ where: { tenantId: ctx.tenantId!, active: true, id: { not: id } } });
      if (others === 0) throw badRequest('LAST_BRANCH', 'Debe quedar al menos una sucursal activa.');
    }
    const br = await this.prisma.branch.update({ where: { id }, data: b });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'branch.update', entity: 'Branch', entityId: id, data: b as object });
    return br;
  }

  // ───────── Empleados ─────────
  private async newPin(tenantId: string): Promise<{ pin: string; lookup: string }> {
    for (let i = 0; i < 30; i++) {
      const pin = randomPin();
      const lookup = pinLookup(tenantId, pin);
      const taken = await this.prisma.employee.findFirst({ where: { tenantId, pinLookup: lookup }, select: { id: true } });
      if (!taken) return { pin, lookup };
    }
    throw new AppError(500, 'PIN', 'No pudimos generar un PIN. Inténtalo nuevamente.');
  }

  @Get('employees')
  async listEmployees(@Ctx() ctx: RequestCtx, @Query('all') all?: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId: ctx.tenantId!, ...(all === '1' ? {} : { active: true }) },
      include: { branch: { select: { id: true, name: true } }, account: { select: { email: true, passwordHash: true } }, _count: { select: { schedules: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((e) => ({
      id: e.id, name: e.name, employeeNumber: e.employeeNumber, phone: e.phone, active: e.active, branch: e.branch,
      hasPin: !!e.pinLookup, hasSchedule: e._count.schedules > 0,
      account: e.account ? { email: e.account.email, activated: !!e.account.passwordHash } : null,
    }));
  }

  @Post('employees')
  @Access('USER', { writable: true })
  async createEmployee(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = employeeCreateS.parse(body);
    const branch = await this.prisma.branch.findFirst({ where: { id: b.branchId, tenantId: ctx.tenantId! } });
    if (!branch) throw badRequest('BRANCH', 'Elige una sucursal válida.');
    if (b.schedule?.length) await this.billing.assertFeature(ctx.tenantId!, 'canSchedules', 'Los horarios y turnos nocturnos están disponibles en el plan Avanzado.');
    await this.billing.assertEmployeeLimit(ctx.tenantId!);
    const number = b.employeeNumber ?? String((await this.prisma.employee.count({ where: { tenantId: ctx.tenantId! } })) + 1).padStart(3, '0');
    const dupNum = await this.prisma.employee.findFirst({ where: { tenantId: ctx.tenantId!, employeeNumber: number } });
    if (dupNum) throw conflict('EMPLOYEE_NUMBER', 'Ya existe un empleado con ese número.');
    const { pin, lookup } = await this.newPin(ctx.tenantId!);
    const emp = await this.prisma.$transaction(async (tx) => {
      const e = await tx.employee.create({
        data: { tenantId: ctx.tenantId!, branchId: b.branchId, name: b.name, employeeNumber: number, phone: b.phone || null, pinLookup: lookup },
      });
      if (b.schedule?.length) await tx.workSchedule.createMany({ data: b.schedule.map((s) => ({ ...s, tenantId: ctx.tenantId!, employeeId: e.id })) });
      await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'employee.create', entity: 'Employee', entityId: e.id }, tx);
      return e;
    });
    return { id: emp.id, name: emp.name, employeeNumber: emp.employeeNumber, pin }; // el PIN sólo se muestra ahora
  }

  @Get('employees/:id')
  async getEmployee(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    const e = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId! },
      include: { branch: { select: { id: true, name: true } }, schedules: { orderBy: { dayOfWeek: 'asc' } }, account: { select: { email: true, passwordHash: true } } },
    });
    if (!e) throw notFound('No encontramos al empleado.');
    return {
      id: e.id, name: e.name, employeeNumber: e.employeeNumber, phone: e.phone, active: e.active, branch: e.branch, hasPin: !!e.pinLookup,
      account: e.account ? { email: e.account.email, activated: !!e.account.passwordHash } : null,
      schedule: e.schedules.map((s) => ({ dayOfWeek: s.dayOfWeek, isRest: s.isRest, startMinutes: s.startMinutes, endMinutes: s.endMinutes })),
    };
  }

  @Patch('employees/:id')
  @Access('USER', { writable: true })
  async updateEmployee(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const b = employeePatchS.parse(body);
    const cur = await this.prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!cur) throw notFound('No encontramos al empleado.');
    if (b.branchId) {
      const br = await this.prisma.branch.findFirst({ where: { id: b.branchId, tenantId: ctx.tenantId! } });
      if (!br) throw badRequest('BRANCH', 'Elige una sucursal válida.');
    }
    if (b.employeeNumber && b.employeeNumber !== cur.employeeNumber) {
      const dup = await this.prisma.employee.findFirst({ where: { tenantId: ctx.tenantId!, employeeNumber: b.employeeNumber } });
      if (dup) throw conflict('EMPLOYEE_NUMBER', 'Ya existe un empleado con ese número.');
    }
    if (b.active === true && !cur.active) await this.billing.assertEmployeeLimit(ctx.tenantId!);
    const e = await this.prisma.employee.update({ where: { id }, data: b });
    if (b.active === false) {
      await this.prisma.employeeAccount.updateMany({ where: { employeeId: id }, data: { active: false } });
      const acc = await this.prisma.employeeAccount.findUnique({ where: { employeeId: id } });
      if (acc) await this.prisma.authSession.updateMany({ where: { subjectType: 'EMPLOYEE', subjectId: acc.id, revokedAt: null }, data: { revokedAt: new Date() } });
    } else if (b.active === true) {
      await this.prisma.employeeAccount.updateMany({ where: { employeeId: id }, data: { active: true } });
    }
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'employee.update', entity: 'Employee', entityId: id, data: b as object });
    return { id: e.id, active: e.active };
  }

  @Post('employees/:id/pin')
  @HttpCode(200)
  @Access('USER', { writable: true })
  async regeneratePin(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    const cur = await this.prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!cur) throw notFound('No encontramos al empleado.');
    const { pin, lookup } = await this.newPin(ctx.tenantId!);
    await this.prisma.employee.update({ where: { id }, data: { pinLookup: lookup } });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'employee.regenerate_pin', entity: 'Employee', entityId: id });
    return { pin };
  }

  @Put('employees/:id/schedule')
  @Access('USER', { writable: true })
  async setSchedule(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    await this.billing.assertFeature(ctx.tenantId!, 'canSchedules', 'Los horarios y turnos nocturnos están disponibles en el plan Avanzado.');
    const schedule = scheduleS.parse((body as { schedule?: unknown })?.schedule);
    const cur = await this.prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!cur) throw notFound('No encontramos al empleado.');
    await this.prisma.$transaction([
      this.prisma.workSchedule.deleteMany({ where: { employeeId: id, tenantId: ctx.tenantId! } }),
      this.prisma.workSchedule.createMany({ data: schedule.map((s) => ({ ...s, tenantId: ctx.tenantId!, employeeId: id })) }),
    ]);
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'employee.schedule', entity: 'Employee', entityId: id });
    return { ok: true };
  }

  @Post('employees/:id/invite')
  @HttpCode(200)
  @Access('USER', { writable: true })
  async invite(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { email } = z.object({ email: emailS }).parse(body);
    const emp = await this.prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId! }, include: { account: true } });
    if (!emp) throw notFound('No encontramos al empleado.');
    if (!emp.active) throw badRequest('INACTIVE', 'Activa al empleado antes de invitarlo.');
    const taken = await this.prisma.employeeAccount.findUnique({ where: { email } });
    if (taken && taken.employeeId !== id) throw conflict('EMAIL_TAKEN', 'Ese correo ya está siendo usado por otro empleado.');
    const acc = emp.account
      ? await this.prisma.employeeAccount.update({ where: { id: emp.account.id }, data: { email, active: true } })
      : await this.prisma.employeeAccount.create({ data: { tenantId: ctx.tenantId!, employeeId: id, email } });
    const raw = randomToken(32);
    await this.prisma.verificationToken.create({
      data: { type: 'EMPLOYEE_INVITE', tokenHash: sha256(raw), subjectId: acc.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const link = `${config.appUrl}/empleado/invitacion?token=${raw}`;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: ctx.tenantId! } });
    await this.mail.send(email, `${tenant?.name}: crea tu acceso para checar`, `Hola ${emp.name}, crea tu contraseña para registrar tu asistencia desde tu celular: ${link}`, link);
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'employee.invite', entity: 'Employee', entityId: id });
    return { link }; // el dueño también puede compartirlo por su cuenta (p. ej. WhatsApp)
  }

  // ───────── Dispositivos ─────────
  @Get('devices')
  async devices(@Ctx() ctx: RequestCtx) {
    const devices = await this.prisma.device.findMany({
      where: { tenantId: ctx.tenantId! }, include: { branch: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' },
    });
    return devices.map((d) => ({ id: d.id, name: d.name, status: d.status, branch: d.branch, lastSeenAt: d.lastSeenAt, createdAt: d.createdAt }));
  }

  @Post('devices/activation')
  @Access('USER', { writable: true })
  async createActivation(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({ branchId: uuidS, name: nameS }).parse(body);
    const branch = await this.prisma.branch.findFirst({ where: { id: b.branchId, tenantId: ctx.tenantId!, active: true } });
    if (!branch) throw badRequest('BRANCH', 'Elige una sucursal válida.');
    const code = randomCode(8);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await this.prisma.deviceActivation.create({ data: { tenantId: ctx.tenantId!, branchId: b.branchId, name: b.name, codeHash: sha256(code), expiresAt } });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'device.activation_code', entity: 'Branch', entityId: b.branchId });
    return { code, expiresAt };
  }

  @Post('devices/:id/revoke')
  @HttpCode(200)
  async revokeDevice(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    const d = await this.prisma.device.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!d) throw notFound();
    await this.prisma.device.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() } });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'device.revoke', entity: 'Device', entityId: id });
    return { ok: true };
  }

  // ───────── Tablero y asistencias ─────────
  @Get('dashboard')
  dashboard(@Ctx() ctx: RequestCtx) { return this.attendance.dashboard(ctx.tenantId!); }

  /**
   * Resuelve el rango pedido y lo recorta al historial que permite el plan (historyDays).
   * Los datos más antiguos NO se borran: vuelven a verse si el cliente sube de plan.
   */
  private async resolveRange(tenantId: string, q: z.infer<typeof rangeQ>) {
    const st = await this.billing.getState(tenantId);
    const br = q.branchId
      ? await this.prisma.branch.findFirst({ where: { id: q.branchId, tenantId } })
      : await this.prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    const today = localDateString(new Date(), br?.timezone ?? 'America/Mexico_City');
    let range: { from: string; to: string };
    if (q.from && q.to) {
      if (q.from > q.to) throw badRequest('RANGE', 'La fecha inicial debe ser anterior a la final.');
      range = { from: q.from, to: q.to };
    } else {
      range = rangeFor((q.range ?? 'today') as RangePreset, today);
    }
    const historyDays = st.plan.historyDays;
    const minDate = addDaysToLocalDate(today, -(historyDays - 1));
    let limited = false;
    if (range.from < minDate) { range = { from: minDate, to: range.to }; limited = true; }
    return { ...range, limited, historyDays, canExport: st.plan.canExport };
  }

  @Get('attendance')
  async attendanceList(@Ctx() ctx: RequestCtx, @Query() query: unknown) {
    const q = rangeQ.parse(query);
    const r = await this.resolveRange(ctx.tenantId!, q);
    const rows = await this.attendance.listSessions(ctx.tenantId!, { from: r.from, to: r.to, employeeId: q.employeeId, branchId: q.branchId, status: q.status });
    const totals = rows.reduce((a, s) => ({ workedMinutes: a.workedMinutes + s.workedMinutes, late: a.late + (s.lateMinutes > 0 ? 1 : 0), incomplete: a.incomplete + (s.status === 'INCOMPLETE' ? 1 : 0) }), { workedMinutes: 0, late: 0, incomplete: 0 });
    return { range: { from: r.from, to: r.to }, limited: r.limited, plan: { historyDays: r.historyDays, canExport: r.canExport }, totals, rows };
  }

  @Get('attendance/export.csv')
  async exportCsv(@Ctx() ctx: RequestCtx, @Query() query: unknown, @Res() res: Response) {
    const q = rangeQ.parse(query);
    const r = await this.resolveRange(ctx.tenantId!, q);
    if (!r.canExport) throw new AppError(403, 'PLAN_FEATURE', 'La exportación a Excel está disponible en el plan Avanzado. Cambia de plan para descargar tus reportes.');
    const rows = await this.attendance.listSessions(ctx.tenantId!, { ...r, employeeId: q.employeeId, branchId: q.branchId, status: q.status });
    const statusEs = { OPEN: 'En curso', CLOSED: 'Completa', INCOMPLETE: 'Incompleta' } as const;
    const lines = [csvLine(['Fecha', 'Empleado', 'Número', 'Sucursal', 'Entrada', 'Salida', 'Horas trabajadas', 'Retardo (min)', 'Salida anticipada (min)', 'Estado', 'Corregida'])];
    for (const s of rows) {
      lines.push(csvLine([s.localDate, s.employeeName, s.employeeNumber, s.branchName, s.startLocal, s.endLocal ?? '', s.endAt ? minutesToHHMM(s.workedMinutes) : '', s.lateMinutes, s.earlyLeaveMinutes, statusEs[s.status], s.corrected ? 'Sí' : 'No']));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="asistencias_${r.from}_${r.to}.csv"`);
    res.send('﻿' + lines.join('\r\n') + '\r\n');
  }

  /** Acepta un instante ISO (startAt) o una hora local de la sucursal 'AAAA-MM-DD HH:mm' (startLocal). */
  private instant(iso: Date | undefined, local: string | null | undefined, tz: string, field: string): Date | null {
    if (iso) return iso;
    if (!local) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(local);
    if (!m) throw badRequest('DATE', `La fecha de ${field} no es válida.`);
    return localToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]) * 60 + Number(m[5]), tz);
  }

  @Post('attendance/manual')
  @Access('USER', { writable: true })
  async manual(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({
      employeeId: uuidS, startAt: z.coerce.date().optional(), endAt: z.coerce.date().optional(),
      startLocal: z.string().optional(), endLocal: z.string().optional(), reason: z.string().trim().min(3, 'Escribe el motivo.').max(300),
    }).parse(body);
    const emp = await this.prisma.employee.findFirst({ where: { id: b.employeeId, tenantId: ctx.tenantId! }, include: { branch: true } });
    if (!emp) throw notFound('No encontramos al empleado.');
    const startAt = this.instant(b.startAt, b.startLocal, emp.branch.timezone, 'entrada');
    const endAt = this.instant(b.endAt, b.endLocal, emp.branch.timezone, 'salida');
    if (!startAt || !endAt) throw badRequest('DATE', 'Indica la hora de entrada y de salida.');
    const s = await this.attendance.createManual(ctx.tenantId!, ctx.userId!, { employeeId: emp.id, startAt, endAt, reason: b.reason });
    return { id: s.id };
  }

  @Post('attendance/:id/correct')
  @HttpCode(200)
  @Access('USER', { writable: true })
  async correct(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const b = z.object({
      startAt: z.coerce.date().optional(), endAt: z.coerce.date().nullable().optional(),
      startLocal: z.string().optional(), endLocal: z.string().nullable().optional(),
      reason: z.string().trim().min(3, 'Escribe el motivo de la corrección.').max(300),
    }).parse(body);
    const cur = await this.prisma.workSession.findFirst({ where: { id, tenantId: ctx.tenantId! }, include: { employee: { include: { branch: true } } } });
    if (!cur) throw notFound('No encontramos esa jornada.');
    const tz = cur.employee.branch.timezone;
    const startAt = this.instant(b.startAt, b.startLocal, tz, 'entrada');
    if (!startAt) throw badRequest('DATE', 'Indica la hora de entrada.');
    const endAt = this.instant(b.endAt ?? undefined, b.endLocal, tz, 'salida');
    const s = await this.attendance.adjust(ctx.tenantId!, ctx.userId!, id, { startAt, endAt, reason: b.reason });
    return { id: s.id, status: s.status, workedMinutes: s.workedMinutes, lateMinutes: s.lateMinutes };
  }

  @Get('attendance/:id/adjustments')
  async adjustments(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    return this.attendance.adjustments(ctx.tenantId!, id);
  }

  // ───────── Suscripción ─────────
  @Get('subscription')
  async subscription(@Ctx() ctx: RequestCtx) {
    const st = await this.billing.getState(ctx.tenantId!);
    const settings = await this.billing.getAllSettings();
    const [payments, employees, branches] = await Promise.all([
      this.prisma.payment.findMany({ where: { tenantId: ctx.tenantId! }, orderBy: { reportedAt: 'desc' }, take: 30 }),
      this.prisma.employee.count({ where: { tenantId: ctx.tenantId!, active: true } }),
      this.prisma.branch.count({ where: { tenantId: ctx.tenantId!, active: true } }),
    ]);
    return {
      status: st.status, operational: st.operational, periodEnd: st.periodEnd, daysLeft: st.daysLeft, graceDays: st.sub.graceDays,
      plan: { name: st.plan.name, priceMonthlyCents: st.plan.priceMonthlyCents, currency: st.plan.currency, maxEmployees: st.plan.maxEmployees, maxBranches: st.plan.maxBranches, historyDays: st.plan.historyDays, canExport: st.plan.canExport, canSchedules: st.plan.canSchedules, canLateControl: st.plan.canLateControl },
      usage: { employees, branches },
      paymentInstructions: settings.payment_instructions, contactEmail: settings.contact_email, contactWhatsapp: settings.contact_whatsapp,
      payments: payments.map((p) => ({ id: p.id, amountCents: p.amountCents, currency: p.currency, months: p.months, reference: p.reference, status: p.status, reportedAt: p.reportedAt, reviewedAt: p.reviewedAt })),
    };
  }

  @Post('subscription/payments')
  async reportPayment(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({
      months: z.number().int().min(1).max(12).default(1),
      reference: z.string().trim().max(120).optional(), notes: z.string().trim().max(500).optional(),
    }).parse(body);
    const st = await this.billing.getState(ctx.tenantId!);
    const pending = await this.prisma.payment.count({ where: { tenantId: ctx.tenantId!, status: 'PENDING' } });
    if (pending >= 3) throw conflict('TOO_MANY_PENDING', 'Ya tienes pagos en revisión. Espera a que los confirmemos.');
    // El monto lo fija el servidor según el plan: el cliente no decide cuánto vale su plan.
    const p = await this.prisma.payment.create({
      data: {
        tenantId: ctx.tenantId!, subscriptionId: st.sub.id, amountCents: st.plan.priceMonthlyCents * b.months, currency: st.plan.currency,
        months: b.months, method: 'TRANSFERENCIA', reference: b.reference, notes: b.notes, status: 'PENDING',
      },
    });
    await this.audit.log({ tenantId: ctx.tenantId, actorType: 'USER', actorId: ctx.userId, action: 'payment.report', entity: 'Payment', entityId: p.id, data: { months: b.months } });
    return { id: p.id, status: p.status };
  }
}
