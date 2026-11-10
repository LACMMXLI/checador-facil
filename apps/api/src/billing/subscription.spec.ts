import { effectiveStatus, isOperational, renewedEnd, addMonths } from './subscription';

const d = (s: string) => new Date(s);
const base = { trialEndsAt: null, currentPeriodEnd: null, graceDays: 3 } as const;

describe('estado efectivo de suscripción', () => {
  it('prueba vigente', () => {
    expect(effectiveStatus({ ...base, status: 'TRIAL', trialEndsAt: d('2026-12-01') }, d('2026-11-20'))).toBe('TRIAL');
  });
  it('prueba vencida entra a gracia y luego se suspende', () => {
    const s = { ...base, status: 'TRIAL' as const, trialEndsAt: d('2026-12-01T00:00:00Z') };
    expect(effectiveStatus(s, d('2026-12-03T00:00:00Z'))).toBe('GRACE_PERIOD');
    expect(effectiveStatus(s, d('2026-12-05T00:00:00Z'))).toBe('SUSPENDED');
  });
  it('activa vigente, vencida con gracia y suspendida', () => {
    const s = { ...base, status: 'ACTIVE' as const, currentPeriodEnd: d('2026-12-01T00:00:00Z') };
    expect(effectiveStatus(s, d('2026-11-30T00:00:00Z'))).toBe('ACTIVE');
    expect(effectiveStatus(s, d('2026-12-02T00:00:00Z'))).toBe('GRACE_PERIOD');
    expect(effectiveStatus(s, d('2026-12-10T00:00:00Z'))).toBe('SUSPENDED');
  });
  it('estados manuales se respetan', () => {
    expect(effectiveStatus({ ...base, status: 'SUSPENDED', currentPeriodEnd: d('2030-01-01') }, d('2026-11-20'))).toBe('SUSPENDED');
    expect(effectiveStatus({ ...base, status: 'CANCELED', currentPeriodEnd: d('2030-01-01') }, d('2026-11-20'))).toBe('CANCELED');
  });
  it('sin fecha de fin se considera suspendida', () => {
    expect(effectiveStatus({ ...base, status: 'ACTIVE' }, d('2026-11-20'))).toBe('SUSPENDED');
  });
  it('operatividad', () => {
    expect(isOperational('TRIAL')).toBe(true);
    expect(isOperational('GRACE_PERIOD')).toBe(true);
    expect(isOperational('SUSPENDED')).toBe(false);
    expect(isOperational('CANCELED')).toBe(false);
  });
});

describe('renovaciones', () => {
  it('suma meses respetando fin de mes', () => {
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
  it('renovar vigente suma sobre la vigencia actual', () => {
    expect(renewedEnd(d('2026-12-10T00:00:00Z'), d('2026-12-01T00:00:00Z'), 1).toISOString()).toBe('2027-01-10T00:00:00.000Z');
  });
  it('renovar vencida suma desde hoy', () => {
    expect(renewedEnd(d('2026-10-01T00:00:00Z'), d('2026-12-01T00:00:00Z'), 1).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
