import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { AppError, notFound } from '../common/errors';
import { addDays, effectiveStatus, isOperational, renewedEnd } from './subscription';

export const DEFAULT_SETTINGS: Record<string, string> = {
  payment_instructions: 'Realiza una transferencia a la cuenta indicada por tu proveedor y reporta tu pago desde esta pantalla.',
  contact_email: 'contacto@example.com',
  contact_whatsapp: '',
  default_grace_days: '3',
  brand_name: 'ChecaFácil',
};

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getSetting(key: string): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
  }
  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany();
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  /** Suscripción + plan + estado efectivo (y lo persiste si cambió por vencimiento). */
  async getState(tenantId: string, now = new Date()) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!sub) throw notFound('Tu negocio no tiene suscripción.');
    const status = effectiveStatus(sub, now);
    const periodEnd = sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd;
    const daysLeft = periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000) : null;
    return { sub, plan: sub.plan, status, operational: isOperational(status), periodEnd, daysLeft };
  }

  async assertOperational(tenantId: string) {
    const st = await this.getState(tenantId);
    if (!st.operational) {
      throw new AppError(402, 'SUBSCRIPTION_SUSPENDED',
        'Tu suscripción está vencida o suspendida. Puedes consultar y exportar tu información, pero no registrar cambios hasta renovar.');
    }
    return st;
  }

  async assertEmployeeLimit(tenantId: string, extra = 1) {
    const { plan } = await this.getState(tenantId);
    const active = await this.prisma.employee.count({ where: { tenantId, active: true } });
    if (active + extra > plan.maxEmployees) {
      throw new AppError(409, 'PLAN_LIMIT_EMPLOYEES', `Tu plan permite hasta ${plan.maxEmployees} empleados activos. Desactiva alguno o pide cambiar de plan.`);
    }
  }
  async assertBranchLimit(tenantId: string) {
    const { plan } = await this.getState(tenantId);
    const active = await this.prisma.branch.count({ where: { tenantId, active: true } });
    if (active + 1 > plan.maxBranches) {
      throw new AppError(409, 'PLAN_LIMIT_BRANCHES', `Tu plan permite hasta ${plan.maxBranches} sucursal(es). Pide cambiar de plan para agregar más.`);
    }
  }

  async createTrial(tx: Prisma.TransactionClient, tenantId: string, planId: string, trialDays: number, now = new Date()) {
    const graceDays = Number(await this.getSetting('default_grace_days')) || 3;
    return tx.subscription.create({
      data: { tenantId, planId, status: 'TRIAL', trialEndsAt: addDays(now, trialDays), graceDays },
    });
  }

  /** Renueva N meses y deja la suscripción ACTIVE. Siempre auditado. */
  async renew(tenantId: string, months: number, actor: { type: string; id: string }, tx?: Prisma.TransactionClient, now = new Date()) {
    const run = async (t: Prisma.TransactionClient) => {
      const sub = await t.subscription.findUnique({ where: { tenantId } });
      if (!sub) throw notFound();
      const current = sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd;
      const end = renewedEnd(current, now, months);
      const updated = await t.subscription.update({
        where: { tenantId }, data: { status: 'ACTIVE', currentPeriodEnd: end, canceledAt: null },
      });
      await this.audit.log({
        tenantId, actorType: actor.type, actorId: actor.id, action: 'subscription.renew', entity: 'Subscription', entityId: sub.id,
        data: { months, previousEnd: current?.toISOString() ?? null, newEnd: end.toISOString(), previousStatus: sub.status },
      }, t);
      return updated;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  async grantDays(tenantId: string, days: number, actor: { type: string; id: string }, now = new Date()) {
    return this.prisma.$transaction(async (t) => {
      const sub = await t.subscription.findUnique({ where: { tenantId } });
      if (!sub) throw notFound();
      const isTrial = sub.status === 'TRIAL';
      const current = isTrial ? sub.trialEndsAt : sub.currentPeriodEnd;
      const base = current && current.getTime() > now.getTime() ? current : now;
      const end = addDays(base, days);
      const updated = await t.subscription.update({
        where: { tenantId },
        data: isTrial ? { trialEndsAt: end } : { currentPeriodEnd: end, status: sub.status === 'SUSPENDED' ? 'ACTIVE' : sub.status },
      });
      await this.audit.log({
        tenantId, actorType: actor.type, actorId: actor.id, action: 'subscription.grant_days', entity: 'Subscription', entityId: sub.id,
        data: { days, previousEnd: current?.toISOString() ?? null, newEnd: end.toISOString() },
      }, t);
      return updated;
    });
  }

  async setStatus(tenantId: string, status: SubscriptionStatus, actor: { type: string; id: string }) {
    return this.prisma.$transaction(async (t) => {
      const sub = await t.subscription.findUnique({ where: { tenantId } });
      if (!sub) throw notFound();
      const updated = await t.subscription.update({
        where: { tenantId }, data: { status, canceledAt: status === 'CANCELED' ? new Date() : null },
      });
      await this.audit.log({
        tenantId, actorType: actor.type, actorId: actor.id, action: `subscription.set_${status.toLowerCase()}`,
        entity: 'Subscription', entityId: sub.id, data: { previousStatus: sub.status },
      }, t);
      return updated;
    });
  }
}
