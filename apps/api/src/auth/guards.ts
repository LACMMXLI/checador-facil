import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../common/prisma.service';
import { SessionService, COOKIES } from './session.service';
import { BillingService } from '../billing/billing.service';
import { config } from '../common/config';
import { AppError, forbidden, unauthorized } from '../common/errors';
import { sha256 } from '../common/crypto';

export type AccessKind = 'USER' | 'EMPLOYEE' | 'PLATFORM' | 'DEVICE';
export interface AccessOpts { kind: AccessKind; writable?: boolean; allowPendingMfa?: boolean }
export const ACCESS_KEY = 'access';
/** Exige sesión del tipo indicado. `writable`: además exige suscripción operativa (bloquea escritura si está suspendida). */
export const Access = (kind: AccessKind, extra: Omit<AccessOpts, 'kind'> = {}) => SetMetadata(ACCESS_KEY, { kind, ...extra } as AccessOpts);

export interface RequestCtx {
  userId?: string; tenantId?: string; role?: string;
  employeeId?: string; accountId?: string;
  adminId?: string; deviceId?: string; branchId?: string; sessionId?: string;
}

/** Protección CSRF: toda petición que modifica datos debe traer el encabezado propio y un Origin válido. */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.headers['x-requested-with'] !== 'reloj') throw forbidden('Solicitud no válida. Recarga la página e inténtalo de nuevo.', 'CSRF');
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { throw forbidden('Solicitud no válida.', 'CSRF'); }
      const allowed = new URL(config.appUrl).host;
      if (host !== allowed && host !== req.headers.host) throw forbidden('Solicitud no válida.', 'CSRF');
    }
    return true;
  }
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService, private sessions: SessionService, private billing: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<AccessOpts | undefined>(ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (!opts) return true;
    const req = context.switchToHttp().getRequest();
    const cookies = req.cookies || {};
    const ctx: RequestCtx = {};

    if (opts.kind === 'USER') {
      const s = await this.sessions.validate(cookies[COOKIES.USER], 'USER');
      if (!s || !s.tenantId) throw unauthorized();
      const m = await this.prisma.membership.findUnique({ where: { userId_tenantId: { userId: s.subjectId, tenantId: s.tenantId } } });
      if (!m) throw unauthorized();
      Object.assign(ctx, { userId: s.subjectId, tenantId: s.tenantId, role: m.role, sessionId: s.id });
      if (opts.writable) await this.billing.assertOperational(s.tenantId);
    } else if (opts.kind === 'EMPLOYEE') {
      const s = await this.sessions.validate(cookies[COOKIES.EMPLOYEE], 'EMPLOYEE');
      if (!s) throw unauthorized();
      const acc = await this.prisma.employeeAccount.findUnique({ where: { id: s.subjectId }, include: { employee: true } });
      if (!acc || !acc.active || !acc.employee.active) throw unauthorized('Tu cuenta no está activa. Habla con tu encargado.');
      Object.assign(ctx, { employeeId: acc.employeeId, tenantId: acc.tenantId, accountId: acc.id, sessionId: s.id });
    } else if (opts.kind === 'PLATFORM') {
      const s = await this.sessions.validate(cookies[COOKIES.PLATFORM_ADMIN ?? 'rs_plat'], 'PLATFORM_ADMIN');
      if (!s) throw unauthorized();
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: s.subjectId } });
      if (!admin) throw unauthorized();
      const mfaNeeded = admin.totpEnabled || config.platformRequireMfa;
      if (mfaNeeded && !s.mfaPassed && !opts.allowPendingMfa) throw new AppError(401, 'MFA_REQUIRED', 'Completa la verificación en dos pasos.');
      Object.assign(ctx, { adminId: admin.id, sessionId: s.id });
    } else {
      const raw = cookies[COOKIES.DEVICE];
      if (!raw) throw unauthorized('Este equipo no está vinculado.', 'DEVICE_UNLINKED');
      const dev = await this.prisma.device.findUnique({ where: { tokenHash: sha256(raw) } });
      if (!dev || dev.status !== 'ACTIVE') throw unauthorized('Este equipo ya no está autorizado. Pide un nuevo código de vinculación.', 'DEVICE_UNLINKED');
      Object.assign(ctx, { deviceId: dev.id, tenantId: dev.tenantId, branchId: dev.branchId });
      if (!dev.lastSeenAt || Date.now() - dev.lastSeenAt.getTime() > 60_000) {
        this.prisma.device.update({ where: { id: dev.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
      }
    }
    req.ctx = ctx;
    return true;
  }
}
