import { Injectable } from '@nestjs/common';
import { Prisma, PunchSource, SessionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { AppError, badRequest, forbidden, notFound } from '../common/errors';
import {
  ScheduleDay, computeMetrics, displayStatus, formatLocal, isStale, localDateString, nextPunchType, resolveShift,
  respectsMinGap, Shift,
} from './engine';

export interface PunchInput {
  tenantId: string;
  employeeId: string;
  deviceId?: string | null;
  /** Sucursal del dispositivo: el empleado debe pertenecer a ella. */
  expectedBranchId?: string;
  source: PunchSource;
  idempotencyKey?: string;
  now?: Date;
}
export interface PunchResult {
  type: 'IN' | 'OUT';
  at: Date;
  employeeName: string;
  branchName: string;
  sessionId: string;
  lateMinutes: number;
  workedMinutes: number;
  duplicate: boolean;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async loadEmployee(tx: Prisma.TransactionClient | PrismaService, p: { tenantId: string; employeeId: string; expectedBranchId?: string }) {
    const emp = await tx.employee.findFirst({ where: { id: p.employeeId, tenantId: p.tenantId }, include: { branch: true } });
    if (!emp || !emp.active) throw forbidden('Tu cuenta no está activa. Habla con tu encargado.', 'EMPLOYEE_INACTIVE');
    if (!emp.branch.active) throw forbidden('Esta sucursal no está activa.', 'BRANCH_INACTIVE');
    if (p.expectedBranchId && emp.branchId !== p.expectedBranchId) {
      throw forbidden('No estás autorizado para registrar asistencia en esta sucursal.', 'WRONG_BRANCH');
    }
    return emp;
  }

  /** Qué movimiento correspondería ahora (sin escribir nada). Usado por el modo "con confirmación". */
  async preview(p: Omit<PunchInput, 'source'>) {
    const now = p.now ?? new Date();
    const emp = await this.loadEmployee(this.prisma, p);
    const open = await this.prisma.workSession.findFirst({ where: { employeeId: emp.id, status: 'OPEN' } });
    const usable = open && !isStale(open.startAt, now, emp.branch.maxOpenHours);
    return { type: nextPunchType(!!usable), employeeName: emp.name, branchName: emp.branch.name };
  }

  /** Registra una checada y devuelve además la hora oficial en la zona de la sucursal. */
  async punch(p: PunchInput): Promise<PunchResult & { atLocal: string }> {
    const r = await this.punchCore(p);
    const e = await this.prisma.employee.findUnique({ where: { id: p.employeeId }, select: { branch: { select: { timezone: true } } } });
    return { ...r, atLocal: formatLocal(r.at, e?.branch.timezone ?? 'America/Mexico_City') };
  }

  /** Núcleo: atómico, con bloqueo por empleado e idempotencia. */
  private async punchCore(p: PunchInput): Promise<PunchResult> {
    const now = p.now ?? new Date();
    const key = p.idempotencyKey ?? randomUUID();
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serializa las checadas de un mismo empleado (evita carreras entre dos celulares/kioscos).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.employeeId}))`;
        const emp = await this.loadEmployee(tx, p);

        const dup = await tx.punchEvent.findUnique({ where: { tenantId_idempotencyKey: { tenantId: p.tenantId, idempotencyKey: key } } });
        if (dup) {
          if (dup.employeeId !== emp.id) throw badRequest('IDEMPOTENCY', 'Solicitud repetida no válida.');
          const s = await tx.workSession.findFirst({ where: { employeeId: emp.id, OR: [{ startAt: dup.occurredAt }, { endAt: dup.occurredAt }] } });
          return {
            type: dup.type, at: dup.occurredAt, employeeName: emp.name, branchName: emp.branch.name, sessionId: s?.id ?? '',
            lateMinutes: s?.lateMinutes ?? 0, workedMinutes: s?.workedMinutes ?? 0, duplicate: true,
          };
        }

        let open = await tx.workSession.findFirst({ where: { employeeId: emp.id, status: 'OPEN' } });
        if (open && isStale(open.startAt, now, emp.branch.maxOpenHours)) {
          // Jornada olvidada: se marca incompleta SIN inventar hora de salida.
          await tx.workSession.update({ where: { id: open.id }, data: { status: 'INCOMPLETE' } });
          await this.audit.log({ tenantId: p.tenantId, actorType: 'SYSTEM', action: 'attendance.mark_incomplete', entity: 'WorkSession', entityId: open.id }, tx);
          open = null;
        }

        const last = await tx.punchEvent.findFirst({ where: { employeeId: emp.id }, orderBy: { occurredAt: 'desc' } });
        if (!respectsMinGap(last?.occurredAt ?? null, now, emp.branch.minPunchGapSeconds)) {
          throw new AppError(409, 'TOO_SOON', 'Ya registraste tu asistencia hace un momento. Espera un poco antes de volver a checar.');
        }

        const type = nextPunchType(!!open);
        const ev = await tx.punchEvent.create({
          data: {
            tenantId: p.tenantId, employeeId: emp.id, branchId: emp.branchId, deviceId: p.deviceId ?? null,
            source: p.source, type, occurredAt: now, idempotencyKey: key,
          },
        });

        if (type === 'IN') {
          const schedules = await tx.workSchedule.findMany({ where: { employeeId: emp.id } });
          const shift = resolveShift(schedules as ScheduleDay[], now, emp.branch.timezone);
          const m = computeMetrics(now, null, shift, emp.branch.lateToleranceMinutes, emp.branch.earlyLeaveToleranceMin);
          const s = await tx.workSession.create({
            data: {
              tenantId: p.tenantId, employeeId: emp.id, branchId: emp.branchId, startAt: now,
              localDate: localDateString(now, emp.branch.timezone), status: 'OPEN',
              scheduledStart: shift?.start ?? null, scheduledEnd: shift?.end ?? null, lateMinutes: m.lateMinutes,
            },
          });
          return { type, at: ev.occurredAt, employeeName: emp.name, branchName: emp.branch.name, sessionId: s.id, lateMinutes: m.lateMinutes, workedMinutes: 0, duplicate: false };
        }

        const shift: Shift | null = open!.scheduledStart && open!.scheduledEnd
          ? { localDate: open!.localDate, start: open!.scheduledStart, end: open!.scheduledEnd } : null;
        const m = computeMetrics(open!.startAt, now, shift, emp.branch.lateToleranceMinutes, emp.branch.earlyLeaveToleranceMin);
        await tx.workSession.update({
          where: { id: open!.id },
          data: { endAt: now, status: 'CLOSED', workedMinutes: m.workedMinutes, earlyLeaveMinutes: m.earlyLeaveMinutes },
        });
        return { type, at: ev.occurredAt, employeeName: emp.name, branchName: emp.branch.name, sessionId: open!.id, lateMinutes: open!.lateMinutes, workedMinutes: m.workedMinutes, duplicate: false };
      }, { timeout: 15_000 });
    } catch (e) {
      // Carrera con la misma clave de idempotencia: devuelve el resultado original.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const dup = await this.prisma.punchEvent.findUnique({ where: { tenantId_idempotencyKey: { tenantId: p.tenantId, idempotencyKey: key } } });
        if (dup) {
          const emp = await this.prisma.employee.findUnique({ where: { id: dup.employeeId }, include: { branch: true } });
          return { type: dup.type, at: dup.occurredAt, employeeName: emp?.name ?? '', branchName: emp?.branch.name ?? '', sessionId: '', lateMinutes: 0, workedMinutes: 0, duplicate: true };
        }
        throw new AppError(409, 'CONFLICT', 'No pudimos registrar tu asistencia. Inténtalo nuevamente.');
      }
      throw e;
    }
  }

  /** Marca como INCOMPLETA toda jornada abierta que excedió el límite de su sucursal. */
  async sweepStale(tenantId: string) {
    await this.prisma.$executeRaw`
      UPDATE "WorkSession" s SET "status" = 'INCOMPLETE'
      FROM "Branch" b
      WHERE s."branchId" = b."id" AND s."tenantId" = ${tenantId}::uuid AND s."status" = 'OPEN'
        AND s."startAt" < now() - make_interval(hours => b."maxOpenHours")`;
  }

  async listSessions(tenantId: string, f: { from: string; to: string; employeeId?: string; branchId?: string; status?: SessionStatus }) {
    await this.sweepStale(tenantId);
    const rows = await this.prisma.workSession.findMany({
      where: {
        tenantId, localDate: { gte: f.from, lte: f.to },
        ...(f.employeeId ? { employeeId: f.employeeId } : {}), ...(f.branchId ? { branchId: f.branchId } : {}),
        ...(f.status ? { status: f.status } : {}),
      },
      include: { employee: { select: { id: true, name: true, employeeNumber: true, branch: { select: { id: true, name: true, timezone: true } } } } },
      orderBy: [{ localDate: 'desc' }, { startAt: 'desc' }],
      take: 5000,
    });
    return rows.map((s) => {
      const tz = s.employee.branch.timezone;
      return {
        id: s.id, employeeId: s.employeeId, employeeName: s.employee.name, employeeNumber: s.employee.employeeNumber,
        branchId: s.employee.branch.id, branchName: s.employee.branch.name, timezone: tz,
        localDate: s.localDate, startAt: s.startAt, endAt: s.endAt,
        startLocal: formatLocal(s.startAt, tz), endLocal: s.endAt ? formatLocal(s.endAt, tz) : null,
        status: s.status, lateMinutes: s.lateMinutes, earlyLeaveMinutes: s.earlyLeaveMinutes, workedMinutes: s.workedMinutes,
        corrected: s.corrected,
      };
    });
  }

  async dashboard(tenantId: string, now = new Date()) {
    await this.sweepStale(tenantId);
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, active: true }, include: { branch: { select: { id: true, name: true, timezone: true } } }, orderBy: { name: 'asc' },
    });
    const since = new Date(now.getTime() - 40 * 3_600_000);
    const recent = await this.prisma.workSession.findMany({
      where: { tenantId, OR: [{ status: 'OPEN' }, { startAt: { gte: since } }] }, orderBy: { startAt: 'desc' },
    });
    let working = 0, entriesToday = 0, lates = 0;
    const list = employees.map((e) => {
      const tz = e.branch.timezone;
      const today = localDateString(now, tz);
      const mine = recent.filter((s) => s.employeeId === e.id);
      const open = mine.find((s) => s.status === 'OPEN');
      const todays = mine.filter((s) => s.localDate === today);
      const incomplete = mine.find((s) => s.status === 'INCOMPLETE' && s.localDate === today);
      const rel = open ?? incomplete ?? todays[0] ?? null;
      const status = displayStatus(rel ? { status: rel.status, lateMinutes: rel.lateMinutes } : null);
      if (open) working++;
      entriesToday += todays.length;
      if (todays.some((s) => s.lateMinutes > 0)) lates++;
      return {
        id: e.id, name: e.name, employeeNumber: e.employeeNumber, branchName: e.branch.name, status,
        since: rel ? formatLocal(rel.startAt, tz) : null, lateMinutes: rel?.lateMinutes ?? 0,
      };
    });
    const incidents = await this.prisma.workSession.count({
      where: { tenantId, status: 'INCOMPLETE', startAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    });
    return { activeEmployees: employees.length, working, entriesToday, lates, incidents, employees: list };
  }

  private async assertNoOverlap(tx: Prisma.TransactionClient, tenantId: string, employeeId: string, start: Date, end: Date | null, excludeId?: string) {
    const horizon = end ?? new Date(start.getTime() + 1);
    const clash = await tx.workSession.findFirst({
      where: {
        tenantId, employeeId, ...(excludeId ? { id: { not: excludeId } } : {}),
        startAt: { lt: horizon },
        OR: [
          { endAt: { gt: start } },
          { endAt: null, status: 'OPEN' },
          // Jornada incompleta (sin salida): se trata como un punto en su hora de entrada.
          { endAt: null, status: 'INCOMPLETE', startAt: { gte: start } },
        ],
      },
    });
    if (clash) throw new AppError(409, 'OVERLAP', 'Las horas se empalman con otra jornada de este empleado.');
  }

  /** Corrección auditada: nunca se borra el original; se guarda valor anterior, nuevo, motivo y responsable. */
  async adjust(tenantId: string, userId: string, sessionId: string, input: { startAt: Date; endAt: Date | null; reason: string }, now = new Date()) {
    if (input.reason.trim().length < 3) throw badRequest('REASON', 'Escribe el motivo de la corrección.');
    if (input.endAt && input.endAt <= input.startAt) throw badRequest('RANGE', 'La salida debe ser posterior a la entrada.');
    if (input.startAt.getTime() > now.getTime() + 5 * 60_000 || (input.endAt && input.endAt.getTime() > now.getTime() + 5 * 60_000)) {
      throw badRequest('FUTURE', 'No puedes registrar horas en el futuro.');
    }
    if (input.endAt && input.endAt.getTime() - input.startAt.getTime() > 24 * 3_600_000) throw badRequest('TOO_LONG', 'Una jornada no puede durar más de 24 horas.');

    return this.prisma.$transaction(async (tx) => {
      const s = await tx.workSession.findFirst({ where: { id: sessionId, tenantId }, include: { employee: { include: { branch: true } } } });
      if (!s) throw notFound('No encontramos esa jornada.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${s.employeeId}))`;
      const branch = s.employee.branch;
      const newStatus: SessionStatus = input.endAt ? 'CLOSED' : s.status === 'CLOSED' ? 'INCOMPLETE' : s.status;
      await this.assertNoOverlap(tx, tenantId, s.employeeId, input.startAt, input.endAt, s.id);
      const schedules = await tx.workSchedule.findMany({ where: { employeeId: s.employeeId } });
      const shift = resolveShift(schedules as ScheduleDay[], input.startAt, branch.timezone);
      const m = computeMetrics(input.startAt, input.endAt, shift, branch.lateToleranceMinutes, branch.earlyLeaveToleranceMin);
      await tx.attendanceAdjustment.create({
        data: {
          tenantId, sessionId: s.id, userId, oldStartAt: s.startAt, oldEndAt: s.endAt, oldStatus: s.status,
          newStartAt: input.startAt, newEndAt: input.endAt, newStatus, reason: input.reason.trim(),
        },
      });
      const updated = await tx.workSession.update({
        where: { id: s.id },
        data: {
          startAt: input.startAt, endAt: input.endAt, status: newStatus, corrected: true,
          localDate: localDateString(input.startAt, branch.timezone),
          scheduledStart: shift?.start ?? null, scheduledEnd: shift?.end ?? null,
          lateMinutes: m.lateMinutes, earlyLeaveMinutes: m.earlyLeaveMinutes, workedMinutes: m.workedMinutes,
        },
      });
      await this.audit.log({
        tenantId, actorType: 'USER', actorId: userId, action: 'attendance.adjust', entity: 'WorkSession', entityId: s.id,
        data: { reason: input.reason.trim(), old: { startAt: s.startAt.toISOString(), endAt: s.endAt?.toISOString() ?? null, status: s.status }, new: { startAt: input.startAt.toISOString(), endAt: input.endAt?.toISOString() ?? null, status: newStatus } },
      }, tx);
      return updated;
    });
  }

  /** Alta manual de una jornada olvidada (genera eventos MANUAL y deja bitácora). */
  async createManual(tenantId: string, userId: string, input: { employeeId: string; startAt: Date; endAt: Date; reason: string }, now = new Date()) {
    if (input.reason.trim().length < 3) throw badRequest('REASON', 'Escribe el motivo del registro manual.');
    if (input.endAt <= input.startAt) throw badRequest('RANGE', 'La salida debe ser posterior a la entrada.');
    if (input.endAt.getTime() > now.getTime() + 5 * 60_000) throw badRequest('FUTURE', 'No puedes registrar horas en el futuro.');
    if (input.endAt.getTime() - input.startAt.getTime() > 24 * 3_600_000) throw badRequest('TOO_LONG', 'Una jornada no puede durar más de 24 horas.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.employeeId}))`;
      const emp = await tx.employee.findFirst({ where: { id: input.employeeId, tenantId }, include: { branch: true } });
      if (!emp) throw notFound('No encontramos al empleado.');
      await this.assertNoOverlap(tx, tenantId, emp.id, input.startAt, input.endAt);
      const schedules = await tx.workSchedule.findMany({ where: { employeeId: emp.id } });
      const shift = resolveShift(schedules as ScheduleDay[], input.startAt, emp.branch.timezone);
      const m = computeMetrics(input.startAt, input.endAt, shift, emp.branch.lateToleranceMinutes, emp.branch.earlyLeaveToleranceMin);
      const grp = randomUUID();
      for (const [type, at] of [['IN', input.startAt], ['OUT', input.endAt]] as const) {
        await tx.punchEvent.create({ data: { tenantId, employeeId: emp.id, branchId: emp.branchId, source: 'MANUAL', type, occurredAt: at, idempotencyKey: `manual:${grp}:${type}` } });
      }
      const s = await tx.workSession.create({
        data: {
          tenantId, employeeId: emp.id, branchId: emp.branchId, startAt: input.startAt, endAt: input.endAt, status: 'CLOSED',
          localDate: localDateString(input.startAt, emp.branch.timezone), scheduledStart: shift?.start ?? null, scheduledEnd: shift?.end ?? null,
          lateMinutes: m.lateMinutes, earlyLeaveMinutes: m.earlyLeaveMinutes, workedMinutes: m.workedMinutes, corrected: true,
        },
      });
      await tx.attendanceAdjustment.create({
        data: { tenantId, sessionId: s.id, userId, newStartAt: input.startAt, newEndAt: input.endAt, newStatus: 'CLOSED', reason: input.reason.trim() },
      });
      await this.audit.log({ tenantId, actorType: 'USER', actorId: userId, action: 'attendance.manual_create', entity: 'WorkSession', entityId: s.id, data: { reason: input.reason.trim() } }, tx);
      return s;
    });
  }

  async adjustments(tenantId: string, sessionId: string) {
    const s = await this.prisma.workSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!s) throw notFound();
    return this.prisma.attendanceAdjustment.findMany({ where: { tenantId, sessionId }, orderBy: { createdAt: 'desc' } });
  }
}
