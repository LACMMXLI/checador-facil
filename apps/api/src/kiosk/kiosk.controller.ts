import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { FailLimiter } from '../common/rate-limiter';
import { BillingService } from '../billing/billing.service';
import { AttendanceService } from '../attendance/attendance.service';
import { Access } from '../auth/guards';
import type { RequestCtx } from '../auth/guards';
import { COOKIES, cookieOptions } from '../auth/session.service';
import { ClientIp, Ctx } from '../common/decorators';
import { AppError, badRequest, forbidden } from '../common/errors';
import { pinLookup, randomToken, sha256 } from '../common/crypto';
import { idemS, pinS } from '../common/schemas';
import { formatLocal } from '../attendance/engine';

export const QR_TTL_SECONDS = 30;
const YEAR = 365 * 86_400_000;

@Controller('kiosk')
export class KioskController {
  constructor(
    private prisma: PrismaService, private audit: AuditService, private limiter: FailLimiter,
    private billing: BillingService, private attendance: AttendanceService,
  ) {}

  /** Vincula este navegador como checador con el código temporal que generó el propietario. */
  @Post('activate')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async activate(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string) {
    const { code } = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'El código tiene 8 letras o números.') }).parse(body);
    const key = `activate:${ip}`;
    this.limiter.check(key);
    const act = await this.prisma.deviceActivation.findUnique({ where: { codeHash: sha256(code) } });
    if (!act || act.usedAt || act.expiresAt < new Date()) {
      this.limiter.fail(key, 8, 15 * 60_000, 15 * 60_000);
      throw badRequest('BAD_CODE', 'Ese código no es válido o ya venció. Pide uno nuevo en tu panel.');
    }
    this.limiter.success(key);
    const raw = randomToken(32);
    const dev = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.deviceActivation.updateMany({ where: { id: act.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw badRequest('BAD_CODE', 'Ese código ya fue utilizado.');
      const d = await tx.device.create({ data: { tenantId: act.tenantId, branchId: act.branchId, name: act.name, tokenHash: sha256(raw) } });
      await tx.deviceActivation.update({ where: { id: act.id }, data: { deviceId: d.id } });
      await this.audit.log({ tenantId: act.tenantId, actorType: 'DEVICE', actorId: d.id, action: 'device.activate', entity: 'Device', entityId: d.id }, tx);
      return d;
    });
    res.cookie(COOKIES.DEVICE, raw, cookieOptions(YEAR));
    return { ok: true, deviceId: dev.id };
  }

  @Get('state')
  @Access('DEVICE')
  async state(@Ctx() ctx: RequestCtx) {
    const [tenant, branch, st] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: ctx.tenantId! } }),
      this.prisma.branch.findUnique({ where: { id: ctx.branchId! } }),
      this.billing.getState(ctx.tenantId!),
    ]);
    return {
      tenantName: tenant?.name, branchName: branch?.name, timezone: branch?.timezone, punchMode: branch?.punchMode,
      qrConfirmMode: branch?.qrConfirmMode, operational: st.operational, serverTime: new Date().toISOString(), qrTtlSeconds: QR_TTL_SECONDS,
    };
  }

  private async recent(ctx: RequestCtx) {
    const tz = (await this.prisma.branch.findUnique({ where: { id: ctx.branchId! } }))?.timezone ?? 'America/Mexico_City';
    const rows = await this.prisma.punchEvent.findMany({
      where: { tenantId: ctx.tenantId!, branchId: ctx.branchId!, occurredAt: { gte: new Date(Date.now() - 10 * 60_000) } },
      orderBy: { occurredAt: 'desc' }, take: 3, include: { employee: { select: { name: true } } },
    });
    return rows.map((r) => ({ name: r.employee.name.split(' ')[0], type: r.type, time: formatLocal(r.occurredAt, tz).slice(11) }));
  }

  /** Genera el siguiente QR dinámico (token aleatorio de vida corta, ligado a este dispositivo y sucursal). */
  @Post('qr')
  @HttpCode(200)
  @Access('DEVICE')
  async qr(@Ctx() ctx: RequestCtx) {
    const [branch, st] = await Promise.all([this.prisma.branch.findUnique({ where: { id: ctx.branchId! } }), this.billing.getState(ctx.tenantId!)]);
    if (!st.operational) throw new AppError(402, 'SUBSCRIPTION_SUSPENDED', 'El servicio está suspendido. Avisa al dueño del negocio.');
    if (!branch || branch.punchMode === 'PIN_ONLY') throw badRequest('QR_DISABLED', 'Esta sucursal no usa código QR.');
    const raw = randomToken(24);
    const now = Date.now();
    const expiresAt = new Date(now + QR_TTL_SECONDS * 1000);
    await this.prisma.qrToken.create({ data: { tenantId: ctx.tenantId!, branchId: ctx.branchId!, deviceId: ctx.deviceId!, tokenHash: sha256(raw), expiresAt } });
    await this.prisma.qrToken.deleteMany({ where: { deviceId: ctx.deviceId!, expiresAt: { lt: new Date(now - 10 * 60_000) } } });
    return { payload: `RS1.${raw}`, expiresAt, serverTime: new Date(now).toISOString(), ttlSeconds: QR_TTL_SECONDS, recent: await this.recent(ctx) };
  }

  @Get('recent')
  @Access('DEVICE')
  recentPunches(@Ctx() ctx: RequestCtx) { return this.recent(ctx); }

  /** Checada con PIN compartido. El servidor identifica al empleado y decide entrada/salida. */
  @Post('pin')
  @HttpCode(200)
  @Access('DEVICE')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async pin(@Ctx() ctx: RequestCtx, @Body() body: unknown, @ClientIp() ip: string) {
    const b = z.object({ pin: pinS, scanId: idemS }).parse(body);
    const keyDev = `pin:dev:${ctx.deviceId}`; const keyIp = `pin:ip:${ip}`;
    this.limiter.check(keyDev); this.limiter.check(keyIp);
    const [branch, st] = await Promise.all([this.prisma.branch.findUnique({ where: { id: ctx.branchId! } }), this.billing.getState(ctx.tenantId!)]);
    if (!st.operational) throw new AppError(402, 'SUBSCRIPTION_SUSPENDED', 'El servicio está suspendido. Avisa al dueño del negocio.');
    if (!branch || branch.punchMode === 'QR_ONLY') throw badRequest('PIN_DISABLED', 'Esta sucursal no usa PIN.');
    const emp = await this.prisma.employee.findFirst({ where: { tenantId: ctx.tenantId!, pinLookup: pinLookup(ctx.tenantId!, b.pin) } });
    if (!emp || !emp.active) {
      // 6 fallos en 5 minutos bloquean el dispositivo 5 minutos; límite más amplio por IP.
      this.limiter.fail(keyDev, 6, 5 * 60_000, 5 * 60_000); this.limiter.fail(keyIp, 30, 5 * 60_000, 10 * 60_000);
      throw forbidden('PIN incorrecto. Inténtalo de nuevo.', 'BAD_PIN');
    }
    this.limiter.success(keyDev);
    const r = await this.attendance.punch({
      tenantId: ctx.tenantId!, employeeId: emp.id, deviceId: ctx.deviceId, expectedBranchId: ctx.branchId,
      source: 'PIN', idempotencyKey: b.scanId ? `pin:${ctx.deviceId}:${b.scanId}` : undefined,
    });
    return { type: r.type, employeeName: r.employeeName, at: r.at, atLocal: r.atLocal, lateMinutes: r.lateMinutes, workedMinutes: r.workedMinutes, duplicate: r.duplicate };
  }
}
