import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { SessionService, COOKIES } from './session.service';
import { MailService } from '../common/mail.service';
import { AuditService } from '../common/audit.service';
import { FailLimiter } from '../common/rate-limiter';
import { BillingService } from '../billing/billing.service';
import { dummyVerify, hashPassword, randomToken, sha256, verifyPassword } from '../common/crypto';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors';
import { emailS, nameS, passwordS } from '../common/schemas';
import { config } from '../common/config';
import { isValidTimezone } from '../attendance/engine';
import { Access } from './guards';
import { ClientIp, Ctx, UserAgent } from '../common/decorators';
import type { RequestCtx } from './guards';

const registerS = z.object({
  planCode: z.string().max(40).optional(),
  businessName: nameS,
  name: nameS,
  email: emailS,
  password: passwordS,
  timezone: z.string().max(60).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los términos y el aviso de privacidad.' }) }),
});
const loginS = z.object({ email: emailS, password: z.string().min(1, 'Escribe tu contraseña.').max(200) });

@Controller('auth')
export class AuthController {
  constructor(
    private prisma: PrismaService, private sessions: SessionService, private mail: MailService,
    private audit: AuditService, private limiter: FailLimiter, private billing: BillingService,
  ) {}

  private async issueToken(type: 'EMAIL_VERIFY' | 'PASSWORD_RESET', subjectId: string, hours: number) {
    const raw = randomToken(32);
    await this.prisma.verificationToken.create({
      data: { type, tokenHash: sha256(raw), subjectId, expiresAt: new Date(Date.now() + hours * 3_600_000) },
    });
    return raw;
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @UserAgent() ua: string) {
    const b = registerS.parse(body);
    if (b.timezone && !isValidTimezone(b.timezone)) throw badRequest('TIMEZONE', 'Zona horaria no válida.');
    const exists = await this.prisma.user.findUnique({ where: { email: b.email } });
    if (exists) throw conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
    const plan = b.planCode
      ? await this.prisma.plan.findFirst({ where: { code: b.planCode, active: true } })
      : await this.prisma.plan.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    if (!plan) throw badRequest('PLAN', 'El plan seleccionado no está disponible.');
    const passwordHash = await hashPassword(b.password);
    const verified = !config.requireEmailVerification;

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: b.email, name: b.name, passwordHash, emailVerifiedAt: verified ? new Date() : null } });
      const tenant = await tx.tenant.create({ data: { name: b.businessName } });
      await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' } });
      await tx.branch.create({ data: { tenantId: tenant.id, name: 'Sucursal principal', timezone: b.timezone || 'America/Mexico_City' } });
      await this.billing.createTrial(tx, tenant.id, plan.id, plan.trialDays);
      await this.audit.log({ tenantId: tenant.id, actorType: 'USER', actorId: user.id, action: 'tenant.register', entity: 'Tenant', entityId: tenant.id, data: { plan: plan.code } }, tx);
      return { user, tenant };
    });

    if (verified) {
      await this.sessions.create(res, 'USER', user.id, { tenantId: tenant.id, userAgent: ua });
      return { requiresVerification: false, user: { id: user.id, name: user.name, email: user.email }, tenant: { id: tenant.id, name: tenant.name } };
    }
    const raw = await this.issueToken('EMAIL_VERIFY', user.id, 48);
    const link = `${config.appUrl}/verificar?token=${raw}`;
    await this.mail.send(user.email, 'Confirma tu correo', `Hola ${user.name}, confirma tu correo para activar tu cuenta: ${link}`, link);
    return { requiresVerification: true };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verify(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @UserAgent() ua: string) {
    const { token } = z.object({ token: z.string().min(10).max(200) }).parse(body);
    const t = await this.prisma.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.type !== 'EMAIL_VERIFY' || t.usedAt || t.expiresAt < new Date()) throw badRequest('TOKEN', 'El enlace ya no es válido. Solicita uno nuevo.');
    const user = await this.prisma.user.update({ where: { id: t.subjectId }, data: { emailVerifiedAt: new Date() } });
    await this.prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    const m = await this.prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    if (m) await this.sessions.create(res, 'USER', user.id, { tenantId: m.tenantId, userAgent: ua });
    return { ok: true };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resend(@Body() body: unknown) {
    const { email } = z.object({ email: emailS }).parse(body);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const raw = await this.issueToken('EMAIL_VERIFY', user.id, 48);
      const link = `${config.appUrl}/verificar?token=${raw}`;
      await this.mail.send(user.email, 'Confirma tu correo', `Confirma tu correo: ${link}`, link);
    }
    return { ok: true }; // misma respuesta exista o no la cuenta
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string, @UserAgent() ua: string) {
    const b = loginS.parse(body);
    const keyA = `login:u:${b.email}`; const keyB = `login:ip:${ip}`;
    this.limiter.check(keyA); this.limiter.check(keyB);
    const user = await this.prisma.user.findUnique({ where: { email: b.email } });
    const ok = user ? await verifyPassword(user.passwordHash, b.password) : (await dummyVerify(b.password), false);
    if (!user || !ok) {
      this.limiter.fail(keyA, 5, 15 * 60_000, 15 * 60_000); this.limiter.fail(keyB, 40, 15 * 60_000, 15 * 60_000);
      throw new AppError(401, 'BAD_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }
    this.limiter.success(keyA);
    if (!user.emailVerifiedAt && config.requireEmailVerification) throw forbidden('Confirma tu correo antes de entrar. Te enviamos un enlace.', 'EMAIL_NOT_VERIFIED');
    const m = await this.prisma.membership.findFirst({ where: { userId: user.id }, include: { tenant: true }, orderBy: { createdAt: 'asc' } });
    if (!m) throw forbidden('Tu cuenta no tiene un negocio asociado.');
    await this.sessions.create(res, 'USER', user.id, { tenantId: m.tenantId, userAgent: ua });
    await this.audit.log({ tenantId: m.tenantId, actorType: 'USER', actorId: user.id, action: 'auth.login' });
    return { user: { id: user.id, name: user.name, email: user.email }, tenant: { id: m.tenant.id, name: m.tenant.name } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeByRaw(req.cookies?.[COOKIES.USER]);
    this.sessions.clear(res, 'USER');
    return { ok: true };
  }

  @Post('forgot')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgot(@Body() body: unknown) {
    const { email } = z.object({ email: emailS }).parse(body);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = await this.issueToken('PASSWORD_RESET', user.id, 2);
      const link = `${config.appUrl}/restablecer?token=${raw}`;
      await this.mail.send(user.email, 'Restablece tu contraseña', `Para crear una nueva contraseña entra aquí (vence en 2 horas): ${link}`, link);
    }
    return { ok: true };
  }

  @Post('reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reset(@Body() body: unknown) {
    const b = z.object({ token: z.string().min(10).max(200), password: passwordS }).parse(body);
    const t = await this.prisma.verificationToken.findUnique({ where: { tokenHash: sha256(b.token) } });
    if (!t || t.type !== 'PASSWORD_RESET' || t.usedAt || t.expiresAt < new Date()) throw badRequest('TOKEN', 'El enlace ya no es válido. Solicita uno nuevo.');
    const passwordHash = await hashPassword(b.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: t.subjectId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
      this.prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
    await this.sessions.revokeAll('USER', t.subjectId); // cierra todas las sesiones activas
    await this.audit.log({ actorType: 'USER', actorId: t.subjectId, action: 'auth.password_reset' });
    return { ok: true };
  }

  @Get('me')
  @Access('USER')
  async me(@Ctx() ctx: RequestCtx) {
    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId! } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: ctx.tenantId! } });
    if (!user || !tenant) throw notFound();
    const st = await this.billing.getState(tenant.id);
    return {
      user: { id: user.id, name: user.name, email: user.email }, tenant: { id: tenant.id, name: tenant.name },
      role: ctx.role,
      subscription: { status: st.status, operational: st.operational, planName: st.plan.name, periodEnd: st.periodEnd, daysLeft: st.daysLeft },
    };
  }
}
