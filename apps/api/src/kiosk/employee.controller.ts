import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { FailLimiter } from '../common/rate-limiter';
import { BillingService } from '../billing/billing.service';
import { AttendanceService } from '../attendance/attendance.service';
import { Access } from '../auth/guards';
import type { RequestCtx } from '../auth/guards';
import { COOKIES, SessionService } from '../auth/session.service';
import { ClientIp, Ctx, UserAgent } from '../common/decorators';
import { AppError, badRequest, forbidden } from '../common/errors';
import { dummyVerify, hashPassword, sha256, verifyPassword } from '../common/crypto';
import { emailS, idemS, passwordS } from '../common/schemas';
import { formatLocal } from '../attendance/engine';

const GRACE_SCAN_MS = 5_000;
const GRACE_CONFIRM_MS = 25_000;

@Controller('employee')
export class EmployeeController {
  constructor(
    private prisma: PrismaService, private audit: AuditService, private limiter: FailLimiter, private billing: BillingService,
    private attendance: AttendanceService, private sessions: SessionService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string, @UserAgent() ua: string) {
    const b = z.object({ email: emailS, password: z.string().min(1, 'Escribe tu contraseña.').max(200) }).parse(body);
    const kA = `elogin:u:${b.email}`; const kB = `elogin:ip:${ip}`;
    this.limiter.check(kA); this.limiter.check(kB);
    const acc = await this.prisma.employeeAccount.findUnique({ where: { email: b.email }, include: { employee: true } });
    const ok = acc?.passwordHash ? await verifyPassword(acc.passwordHash, b.password) : (await dummyVerify(b.password), false);
    if (!acc || !ok) {
      this.limiter.fail(kA, 5, 15 * 60_000, 15 * 60_000); this.limiter.fail(kB, 40, 15 * 60_000, 15 * 60_000);
      throw new AppError(401, 'BAD_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }
    this.limiter.success(kA);
    if (!acc.active || !acc.employee.active) throw forbidden('Tu cuenta no está activa. Habla con tu encargado.');
    await this.sessions.create(res, 'EMPLOYEE', acc.id, { tenantId: acc.tenantId, userAgent: ua });
    return { ok: true };
  }

  @Post('accept-invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async acceptInvite(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @UserAgent() ua: string) {
    const b = z.object({ token: z.string().min(10).max(200), password: passwordS }).parse(body);
    const t = await this.prisma.verificationToken.findUnique({ where: { tokenHash: sha256(b.token) } });
    if (!t || t.type !== 'EMPLOYEE_INVITE' || t.usedAt || t.expiresAt < new Date()) throw badRequest('TOKEN', 'La invitación ya no es válida. Pide una nueva a tu encargado.');
    const acc = await this.prisma.employeeAccount.findUnique({ where: { id: t.subjectId }, include: { employee: true } });
    if (!acc || !acc.employee.active) throw badRequest('TOKEN', 'La invitación ya no es válida.');
    await this.prisma.$transaction([
      this.prisma.employeeAccount.update({ where: { id: acc.id }, data: { passwordHash: await hashPassword(b.password), active: true } }),
      this.prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
    await this.sessions.revokeAll('EMPLOYEE', acc.id);
    await this.sessions.create(res, 'EMPLOYEE', acc.id, { tenantId: acc.tenantId, userAgent: ua });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeByRaw(req.cookies?.[COOKIES.EMPLOYEE]);
    this.sessions.clear(res, 'EMPLOYEE');
    return { ok: true };
  }

  @Get('me')
  @Access('EMPLOYEE')
  async me(@Ctx() ctx: RequestCtx) {
    const emp = await this.prisma.employee.findFirstOrThrow({ where: { id: ctx.employeeId!, tenantId: ctx.tenantId! }, include: { branch: true, tenant: true } });
    const tz = emp.branch.timezone;
    const [open, last, st] = await Promise.all([
      this.prisma.workSession.findFirst({ where: { employeeId: emp.id, status: 'OPEN' } }),
      this.prisma.punchEvent.findFirst({ where: { employeeId: emp.id }, orderBy: { occurredAt: 'desc' } }),
      this.billing.getState(ctx.tenantId!),
    ]);
    const working = !!open && Date.now() - open.startAt.getTime() <= emp.branch.maxOpenHours * 3_600_000;
    return {
      name: emp.name, tenantName: emp.tenant.name, branchName: emp.branch.name, punchMode: emp.branch.punchMode, qrConfirmMode: emp.branch.qrConfirmMode,
      operational: st.operational, working, since: working ? formatLocal(open!.startAt, tz) : null,
      lastPunch: last ? { type: last.type, at: last.occurredAt, local: formatLocal(last.occurredAt, tz) } : null,
      canScan: emp.branch.punchMode !== 'PIN_ONLY',
    };
  }

  @Get('history')
  @Access('EMPLOYEE')
  async history(@Ctx() ctx: RequestCtx, @Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const emp = await this.prisma.employee.findFirstOrThrow({ where: { id: ctx.employeeId!, tenantId: ctx.tenantId! }, include: { branch: true } });
    const late = (await this.billing.getState(ctx.tenantId!)).plan.canLateControl;
    const rows = await this.prisma.workSession.findMany({ where: { employeeId: emp.id, tenantId: ctx.tenantId! }, orderBy: { startAt: 'desc' }, take });
    const tz = emp.branch.timezone;
    return rows.map((s) => ({
      id: s.id, localDate: s.localDate, startLocal: formatLocal(s.startAt, tz), endLocal: s.endAt ? formatLocal(s.endAt, tz) : null,
      status: s.status, workedMinutes: s.workedMinutes, lateMinutes: late ? s.lateMinutes : 0,
    }));
  }

  /** Escaneo del QR dinámico del establecimiento. La identidad sale de la sesión, nunca del QR. */
  @Post('scan')
  @HttpCode(200)
  @Access('EMPLOYEE')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async scan(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({ payload: z.string().min(8).max(200), scanId: idemS, confirm: z.boolean().optional() }).parse(body);
    if (!b.payload.startsWith('RS1.')) throw badRequest('QR_INVALID', 'Este código no es válido. Escanea el QR del checador de tu negocio.');
    const tok = await this.prisma.qrToken.findUnique({ where: { tokenHash: sha256(b.payload.slice(4)) }, include: { device: true } });
    if (!tok || tok.tenantId !== ctx.tenantId) throw badRequest('QR_INVALID', 'Este código no es válido. Escanea el QR del checador de tu negocio.');
    if (tok.device.status !== 'ACTIVE') throw badRequest('DEVICE_REVOKED', 'Este checador ya no está autorizado.');
    const grace = b.confirm ? GRACE_CONFIRM_MS : GRACE_SCAN_MS;
    if (tok.expiresAt.getTime() + grace < Date.now()) throw badRequest('QR_EXPIRED', 'El código expiró. Escanea el QR de nuevo.');
    const [branch, st] = await Promise.all([this.prisma.branch.findUniqueOrThrow({ where: { id: tok.branchId } }), this.billing.getState(ctx.tenantId!)]);
    if (branch.punchMode === 'PIN_ONLY') throw badRequest('QR_DISABLED', 'Esta sucursal no usa código QR.');
    if (!st.operational) throw new AppError(402, 'SUBSCRIPTION_SUSPENDED', 'El servicio está suspendido. Avisa al dueño del negocio.');

    const base = { tenantId: ctx.tenantId!, employeeId: ctx.employeeId!, deviceId: tok.deviceId, expectedBranchId: tok.branchId };
    if (branch.qrConfirmMode === 'CONFIRM' && !b.confirm) {
      const pv = await this.attendance.preview(base);
      return { requiresConfirmation: true, type: pv.type, employeeName: pv.employeeName, branchName: pv.branchName };
    }
    const r = await this.attendance.punch({
      ...base, source: branch.qrConfirmMode === 'CONFIRM' ? 'QR_CONFIRM' : 'QR_AUTO',
      idempotencyKey: b.scanId ? `qr:${ctx.employeeId}:${b.scanId}` : undefined,
    });
    return { requiresConfirmation: false, type: r.type, employeeName: r.employeeName, branchName: r.branchName, at: r.at, atLocal: r.atLocal, lateMinutes: r.lateMinutes, workedMinutes: r.workedMinutes, duplicate: r.duplicate };
  }
}
