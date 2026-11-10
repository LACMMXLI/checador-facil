import { SubscriptionStatus } from '@prisma/client';

export interface SubLike {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceDays: number;
}

const DAY = 86_400_000;

/**
 * Estado efectivo de una suscripción en un instante dado. Es función pura:
 *  - SUSPENDED y CANCELED son estados manuales y se respetan.
 *  - TRIAL/ACTIVE vigentes → su estado; vencidos → GRACE_PERIOD durante `graceDays`; luego SUSPENDED.
 *  - PAST_DUE lo marca manualmente el administrador; sigue la misma lógica de gracia.
 */
export function effectiveStatus(sub: SubLike, now: Date): SubscriptionStatus {
  if (sub.status === 'SUSPENDED' || sub.status === 'CANCELED') return sub.status;
  const end = sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd;
  if (!end) return 'SUSPENDED';
  if (now.getTime() <= end.getTime()) return sub.status === 'TRIAL' ? 'TRIAL' : sub.status === 'PAST_DUE' ? 'PAST_DUE' : 'ACTIVE';
  if (now.getTime() <= end.getTime() + sub.graceDays * DAY) return sub.status === 'PAST_DUE' ? 'PAST_DUE' : 'GRACE_PERIOD';
  return 'SUSPENDED';
}

/** Con estos estados se puede checar y administrar. En SUSPENDED/CANCELED sólo se consulta y exporta. */
export function isOperational(status: SubscriptionStatus): boolean {
  return status === 'TRIAL' || status === 'ACTIVE' || status === 'PAST_DUE' || status === 'GRACE_PERIOD';
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY);
}

/** Nueva fecha de fin al renovar: parte de la vigencia actual si aún no vence, o de hoy si ya venció. */
export function renewedEnd(current: Date | null, now: Date, months: number): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return addMonths(base, months);
}
