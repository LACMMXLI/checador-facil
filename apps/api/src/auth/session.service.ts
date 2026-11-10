import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { SubjectType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { randomToken, sha256 } from '../common/crypto';
import { config } from '../common/config';

export const COOKIES: Record<SubjectType | 'DEVICE', string> = {
  USER: 'rs_user', EMPLOYEE: 'rs_emp', PLATFORM_ADMIN: 'rs_plat', DEVICE: 'rs_dev',
};

const HOUR = 3_600_000;
export const TTL: Record<SubjectType, number> = {
  USER: 14 * 24 * HOUR, EMPLOYEE: 90 * 24 * HOUR, PLATFORM_ADMIN: 8 * HOUR,
};

export function cookieOptions(maxAgeMs: number) {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax' as const, path: '/', maxAge: maxAgeMs };
}

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async create(res: Response, type: SubjectType, subjectId: string, opts: { tenantId?: string; mfaPassed?: boolean; userAgent?: string } = {}) {
    const raw = randomToken(32);
    const ttl = TTL[type];
    await this.prisma.authSession.create({
      data: {
        tokenHash: sha256(raw), subjectType: type, subjectId, tenantId: opts.tenantId ?? null,
        mfaPassed: opts.mfaPassed ?? false, expiresAt: new Date(Date.now() + ttl), userAgent: opts.userAgent?.slice(0, 200),
      },
    });
    res.cookie(COOKIES[type], raw, cookieOptions(ttl));
  }

  async validate(raw: string | undefined, type: SubjectType) {
    if (!raw) return null;
    const s = await this.prisma.authSession.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!s || s.subjectType !== type || s.revokedAt || s.expiresAt.getTime() < Date.now()) return null;
    return s;
  }

  async revokeByRaw(raw: string | undefined) {
    if (!raw) return;
    await this.prisma.authSession.updateMany({ where: { tokenHash: sha256(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAll(type: SubjectType, subjectId: string) {
    await this.prisma.authSession.updateMany({ where: { subjectType: type, subjectId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  clear(res: Response, type: SubjectType | 'DEVICE') {
    res.clearCookie(COOKIES[type], { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' });
  }
}
