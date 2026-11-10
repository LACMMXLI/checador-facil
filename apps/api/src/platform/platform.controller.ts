import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { FailLimiter } from '../common/rate-limiter';
import { BillingService, DEFAULT_SETTINGS } from '../billing/billing.service';
import { Access } from '../auth/guards';
import type { RequestCtx } from '../auth/guards';
import { COOKIES, SessionService } from '../auth/session.service';
import { ClientIp, Ctx, UserAgent } from '../common/decorators';
import { AppError, badRequest, conflict, notFound } from '../common/errors';
import { dummyVerify, hashPassword, randomToken, verifyPassword } from '../common/crypto';
import { emailS, nameS, uuidS } from '../common/schemas';
import { newTotpSecret, otpauthUri, verifyTotp } from '../common/totp';
import { config } from '../common/config';
import { effectiveStatus } from '../billing/subscription';

const planS = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/, 'El código sólo admite letras, números y guiones.'),
  name: nameS,
  description: z.string().trim().max(300).default(''),
  priceMonthlyCents: z.number().int().min(0).max(100_000_00),
  currency: z.string().length(3).default('MXN'),
  maxEmployees: z.number().int().min(1).max(10_000),
  maxBranches: z.number().int().min(1).max(1_000),
  trialDays: z.number().int().min(0).max(120),
  historyDays: z.number().int().min(1).max(3650).default(365),
  canExport: z.boolean().default(true),
  features: z.array(z.string().trim().min(1).max(120)).max(15),
  highlighted: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const actor = (ctx: RequestCtx) => ({ type: 'PLATFORM_ADMIN', id: ctx.adminId! });

@Controller('platform')
export class PlatformController {
  constructor(
    private prisma: PrismaService, private audit: AuditService, private limiter: FailLimiter,
    private billing: BillingService, private sessions: SessionService,
  ) {}

  // ───────── Autenticación (separada de la de los negocios) ─────────
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string, @UserAgent() ua: string) {
    const b = z.object({ email: emailS, password: z.string().min(1).max(200), code: z.string().max(10).optional() }).parse(body);
    const kA = `plogin:u:${b.email}`; const kB = `plogin:ip:${ip}`;
    this.limiter.check(kA); this.limiter.check(kB);
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: b.email } });
    const ok = admin ? await verifyPassword(admin.passwordHash, b.password) : (await dummyVerify(b.password), false);
    if (!admin || !ok) {
      this.limiter.fail(kA, 5, 15 * 60_000, 30 * 60_000); this.limiter.fail(kB, 20, 15 * 60_000, 30 * 60_000);
      throw new AppError(401, 'BAD_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }
    const mfaNeeded = admin.totpEnabled || config.platformRequireMfa;
    let mfaPassed = !mfaNeeded;
    if (admin.totpEnabled && b.code) {
      if (!verifyTotp(admin.totpSecret!, b.code)) {
        this.limiter.fail(kA, 5, 15 * 60_000, 30 * 60_000);
        throw new AppError(401, 'BAD_CODE', 'El código de verificación es incorrecto.');
      }
      mfaPassed = true;
    }
    this.limiter.success(kA);
    await this.sessions.create(res, 'PLATFORM_ADMIN', admin.id, { mfaPassed, userAgent: ua });
    await this.audit.log({ actorType: 'PLATFORM_ADMIN', actorId: admin.id, action: 'platform.login', data: { mfaPassed } });
    return { mfaRequired: !mfaPassed, mfaSetupRequired: !mfaPassed && !admin.totpEnabled };
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @Access('PLATFORM', { allowPendingMfa: true })
  async mfaVerify(@Ctx() ctx: RequestCtx, @Body() body: unknown, @ClientIp() ip: string) {
    const { code } = z.object({ code: z.string().max(10) }).parse(body);
    const k = `pmfa:${ctx.adminId}`; this.limiter.check(k);
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({ where: { id: ctx.adminId! } });
    if (!admin.totpEnabled || !verifyTotp(admin.totpSecret!, code)) {
      this.limiter.fail(k, 5, 15 * 60_000, 30 * 60_000);
      throw new AppError(401, 'BAD_CODE', 'El código de verificación es incorrecto.');
    }
    this.limiter.success(k);
    await this.prisma.authSession.update({ where: { id: ctx.sessionId! }, data: { mfaPassed: true } });
    return { ok: true };
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @Access('PLATFORM', { allowPendingMfa: true })
  async mfaSetup(@Ctx() ctx: RequestCtx) {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({ where: { id: ctx.adminId! } });
    if (admin.totpEnabled) throw conflict('MFA_ENABLED', 'La verificación en dos pasos ya está activada.');
    const secret = newTotpSecret();
    await this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { totpSecret: secret } });
    return { secret, otpauthUri: otpauthUri(secret, admin.email, 'Reloj Checador SaaS') };
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @Access('PLATFORM', { allowPendingMfa: true })
  async mfaEnable(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const { code } = z.object({ code: z.string().max(10) }).parse(body);
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({ where: { id: ctx.adminId! } });
    if (!admin.totpSecret || admin.totpEnabled) throw badRequest('MFA', 'Primero genera tu código QR de configuración.');
    if (!verifyTotp(admin.totpSecret, code)) throw new AppError(401, 'BAD_CODE', 'El código de verificación es incorrecto.');
    await this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { totpEnabled: true } });
    await this.prisma.authSession.update({ where: { id: ctx.sessionId! }, data: { mfaPassed: true } });
    await this.audit.log({ actorType: 'PLATFORM_ADMIN', actorId: admin.id, action: 'platform.mfa_enabled' });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeByRaw(req.cookies?.[COOKIES.PLATFORM_ADMIN]);
    this.sessions.clear(res, 'PLATFORM_ADMIN');
    return { ok: true };
  }

  @Get('me')
  @Access('PLATFORM')
  async me(@Ctx() ctx: RequestCtx) {
    const a = await this.prisma.platformAdmin.findUniqueOrThrow({ where: { id: ctx.adminId! } });
    return { email: a.email, mfaEnabled: a.totpEnabled };
  }

  // ───────── Indicadores ─────────
  @Get('metrics')
  @Access('PLATFORM')
  async metrics() {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({ where: { tenant: { isDemo: false } }, include: { tenant: true } });
    const eff = subs.map((s) => ({ s, st: effectiveStatus(s, now) }));
    const in7 = new Date(now.getTime() + 7 * 86_400_000);
    const expiringSoon = eff.filter(({ s, st }) => (st === 'ACTIVE' || st === 'TRIAL') && (s.status === 'TRIAL' ? s.trialEndsAt : s.currentPeriodEnd)! <= in7).length;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [revTotal, revMonth, newTenants] = await Promise.all([
      this.prisma.payment.aggregate({ where: { status: 'APPROVED', tenant: { isDemo: false } }, _sum: { amountCents: true } }),
      this.prisma.payment.aggregate({ where: { status: 'APPROVED', reviewedAt: { gte: monthStart }, tenant: { isDemo: false } }, _sum: { amountCents: true } }),
      this.prisma.tenant.count({ where: { isDemo: false, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } }),
    ]);
    const pendingPayments = await this.prisma.payment.count({ where: { status: 'PENDING' } });
    return {
      tenants: subs.length,
      active: eff.filter((x) => x.st === 'ACTIVE').length,
      trial: eff.filter((x) => x.st === 'TRIAL').length,
      grace: eff.filter((x) => x.st === 'GRACE_PERIOD' || x.st === 'PAST_DUE').length,
      overdue: eff.filter((x) => x.st === 'SUSPENDED').length,
      canceled: eff.filter((x) => x.st === 'CANCELED').length,
      expiringSoon, newTenants30d: newTenants, pendingPayments,
      revenueTotalCents: revTotal._sum.amountCents ?? 0, revenueMonthCents: revMonth._sum.amountCents ?? 0,
    };
  }

  // ───────── Negocios ─────────
  @Get('tenants')
  @Access('PLATFORM')
  async tenants(@Query('q') q?: string) {
    const rows = await this.prisma.tenant.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { memberships: { some: { user: { email: { contains: q, mode: 'insensitive' } } } } }] } : {},
      include: {
        subscription: { include: { plan: true } },
        memberships: { include: { user: { select: { name: true, email: true } } }, take: 1, orderBy: { createdAt: 'asc' } },
        _count: { select: { employees: true, branches: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
    const now = new Date();
    return Promise.all(rows.map(async (t) => {
      const activeEmployees = await this.prisma.employee.count({ where: { tenantId: t.id, active: true } });
      const sub = t.subscription;
      return {
        id: t.id, name: t.name, isDemo: t.isDemo, createdAt: t.createdAt,
        owner: t.memberships[0]?.user ?? null, activeEmployees, branches: t._count.branches,
        plan: sub ? { id: sub.planId, name: sub.plan.name } : null,
        status: sub ? effectiveStatus(sub, now) : null, storedStatus: sub?.status ?? null,
        periodEnd: sub ? (sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd) : null,
      };
    }));
  }

  @Post('tenants')
  @Access('PLATFORM')
  async createTenant(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = z.object({
      businessName: nameS, ownerName: nameS, ownerEmail: emailS, planCode: z.string().max(40), trialDays: z.number().int().min(0).max(365).optional(),
    }).parse(body);
    if (await this.prisma.user.findUnique({ where: { email: b.ownerEmail } })) throw conflict('EMAIL_TAKEN', 'Ya existe un usuario con ese correo.');
    const plan = await this.prisma.plan.findUnique({ where: { code: b.planCode } });
    if (!plan) throw badRequest('PLAN', 'Plan no encontrado.');
    const tempPassword = `${randomToken(6)}A1`;
    const t = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: b.ownerEmail, name: b.ownerName, passwordHash: await hashPassword(tempPassword), emailVerifiedAt: new Date() } });
      const tenant = await tx.tenant.create({ data: { name: b.businessName } });
      await tx.membership.create({ data: { userId: u.id, tenantId: tenant.id, role: 'OWNER' } });
      await tx.branch.create({ data: { tenantId: tenant.id, name: 'Sucursal principal' } });
      await this.billing.createTrial(tx, tenant.id, plan.id, b.trialDays ?? plan.trialDays);
      await this.audit.log({ tenantId: tenant.id, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'tenant.create_by_admin', entity: 'Tenant', entityId: tenant.id }, tx);
      return tenant;
    });
    return { id: t.id, ownerEmail: b.ownerEmail, tempPassword }; // la contraseña temporal sólo se muestra una vez
  }

  @Get('tenants/:id')
  @Access('PLATFORM')
  async tenant(@Param('id') id: string) {
    uuidS.parse(id);
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } }, memberships: { include: { user: { select: { name: true, email: true, emailVerifiedAt: true } } } }, branches: true },
    });
    if (!t) throw notFound('No encontramos ese negocio.');
    const [payments, audit, activeEmployees, devices] = await Promise.all([
      this.prisma.payment.findMany({ where: { tenantId: id }, orderBy: { reportedAt: 'desc' }, take: 50 }),
      this.prisma.auditLog.findMany({ where: { tenantId: id, action: { startsWith: 'subscription' } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.employee.count({ where: { tenantId: id, active: true } }),
      this.prisma.device.count({ where: { tenantId: id, status: 'ACTIVE' } }),
    ]);
    const sub = t.subscription;
    return {
      id: t.id, name: t.name, createdAt: t.createdAt, owners: t.memberships.map((m) => m.user), branches: t.branches.map((b) => ({ id: b.id, name: b.name, active: b.active })),
      activeEmployees, activeDevices: devices,
      subscription: sub && { id: sub.id, plan: sub.plan, storedStatus: sub.status, status: effectiveStatus(sub, new Date()), trialEndsAt: sub.trialEndsAt, currentPeriodEnd: sub.currentPeriodEnd, graceDays: sub.graceDays },
      payments, audit,
    };
  }

  @Post('tenants/:id/renew')
  @HttpCode(200)
  @Access('PLATFORM')
  async renew(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { months } = z.object({ months: z.number().int().min(1).max(24) }).parse(body);
    const s = await this.billing.renew(id, months, actor(ctx));
    return { status: s.status, currentPeriodEnd: s.currentPeriodEnd };
  }

  @Post('tenants/:id/grant-days')
  @HttpCode(200)
  @Access('PLATFORM')
  async grantDays(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { days } = z.object({ days: z.number().int().min(1).max(365) }).parse(body);
    await this.billing.grantDays(id, days, actor(ctx));
    return { ok: true };
  }

  @Post('tenants/:id/status')
  @HttpCode(200)
  @Access('PLATFORM')
  async setStatus(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELED', 'PAST_DUE']) }).parse(body);
    await this.billing.setStatus(id, status, actor(ctx));
    return { ok: true };
  }

  @Post('tenants/:id/trial')
  @HttpCode(200)
  @Access('PLATFORM')
  async startTrial(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { days } = z.object({ days: z.number().int().min(1).max(120) }).parse(body);
    await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { tenantId: id } });
      if (!sub) throw notFound();
      await tx.subscription.update({ where: { tenantId: id }, data: { status: 'TRIAL', trialEndsAt: new Date(Date.now() + days * 86_400_000), canceledAt: null } });
      await this.audit.log({ tenantId: id, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'subscription.start_trial', entity: 'Subscription', entityId: sub.id, data: { days, previousStatus: sub.status } }, tx);
    });
    return { ok: true };
  }

  @Patch('tenants/:id/plan')
  @Access('PLATFORM')
  async changePlan(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const { planId } = z.object({ planId: uuidS }).parse(body);
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw badRequest('PLAN', 'Plan no encontrado.');
    const sub = await this.prisma.subscription.update({ where: { tenantId: id }, data: { planId } });
    await this.audit.log({ tenantId: id, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'subscription.change_plan', entity: 'Subscription', entityId: sub.id, data: { plan: plan.code } });
    return { ok: true };
  }

  @Post('tenants/:id/payments')
  @Access('PLATFORM')
  async recordPayment(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const b = z.object({
      amountCents: z.number().int().min(0).max(100_000_00), months: z.number().int().min(1).max(24),
      method: z.string().trim().max(40).default('TRANSFERENCIA'), reference: z.string().trim().max(120).optional(),
    }).parse(body);
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: id }, include: { plan: true } });
    if (!sub) throw notFound();
    const p = await this.prisma.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: { tenantId: id, subscriptionId: sub.id, amountCents: b.amountCents, currency: sub.plan.currency, months: b.months, method: b.method, reference: b.reference, status: 'APPROVED', reviewedAt: new Date(), reviewedBy: ctx.adminId },
      });
      await this.billing.renew(id, b.months, actor(ctx), tx);
      await this.audit.log({ tenantId: id, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'payment.record', entity: 'Payment', entityId: pay.id, data: { amountCents: b.amountCents, months: b.months } }, tx);
      return pay;
    });
    return { id: p.id };
  }

  // ───────── Pagos reportados ─────────
  @Get('payments')
  @Access('PLATFORM')
  async payments(@Query('status') status?: string) {
    const st = z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().parse(status);
    const rows = await this.prisma.payment.findMany({ where: st ? { status: st } : {}, include: { tenant: { select: { id: true, name: true } } }, orderBy: { reportedAt: 'desc' }, take: 300 });
    return rows;
  }

  @Post('payments/:id/approve')
  @HttpCode(200)
  @Access('PLATFORM')
  async approve(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    await this.prisma.$transaction(async (tx) => {
      // updateMany condicionado: dos aprobaciones simultáneas no pueden renovar dos veces.
      const claimed = await tx.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: ctx.adminId } });
      if (claimed.count !== 1) throw conflict('NOT_PENDING', 'Este pago ya fue revisado.');
      const pay = await tx.payment.findUniqueOrThrow({ where: { id } });
      await this.billing.renew(pay.tenantId, pay.months, actor(ctx), tx);
      await this.audit.log({ tenantId: pay.tenantId, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'payment.approve', entity: 'Payment', entityId: id, data: { amountCents: pay.amountCents, months: pay.months } }, tx);
    });
    return { ok: true };
  }

  @Post('payments/:id/reject')
  @HttpCode(200)
  @Access('PLATFORM')
  async reject(@Ctx() ctx: RequestCtx, @Param('id') id: string) {
    uuidS.parse(id);
    const claimed = await this.prisma.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: ctx.adminId } });
    if (claimed.count !== 1) throw conflict('NOT_PENDING', 'Este pago ya fue revisado.');
    const pay = await this.prisma.payment.findUniqueOrThrow({ where: { id } });
    await this.audit.log({ tenantId: pay.tenantId, actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'payment.reject', entity: 'Payment', entityId: id });
    return { ok: true };
  }

  // ───────── Planes ─────────
  @Get('plans')
  @Access('PLATFORM')
  plans() { return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }); }

  @Post('plans')
  @Access('PLATFORM')
  async createPlan(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const b = planS.parse(body);
    if (await this.prisma.plan.findUnique({ where: { code: b.code } })) throw conflict('PLAN_CODE', 'Ya existe un plan con ese código.');
    const p = await this.prisma.plan.create({ data: b });
    await this.audit.log({ actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'plan.create', entity: 'Plan', entityId: p.id });
    return p;
  }

  @Patch('plans/:id')
  @Access('PLATFORM')
  async updatePlan(@Ctx() ctx: RequestCtx, @Param('id') id: string, @Body() body: unknown) {
    uuidS.parse(id);
    const b = planS.partial().parse(body);
    const p = await this.prisma.plan.update({ where: { id }, data: b });
    await this.audit.log({ actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'plan.update', entity: 'Plan', entityId: id, data: b as object });
    return p;
  }

  // ───────── Configuración general ─────────
  @Get('settings')
  @Access('PLATFORM')
  settings() { return this.billing.getAllSettings(); }

  @Put('settings')
  @Access('PLATFORM')
  async putSettings(@Ctx() ctx: RequestCtx, @Body() body: unknown) {
    const entries = Object.entries(z.record(z.string().max(1000)).parse(body)).filter(([k]) => k in DEFAULT_SETTINGS);
    for (const [key, value] of entries) await this.prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    await this.audit.log({ actorType: 'PLATFORM_ADMIN', actorId: ctx.adminId, action: 'settings.update', data: { keys: entries.map(([k]) => k) } });
    return this.billing.getAllSettings();
  }

  @Get('audit')
  @Access('PLATFORM')
  auditLog(@Query('tenantId') tenantId?: string) {
    return this.prisma.auditLog.findMany({ where: tenantId ? { tenantId } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
