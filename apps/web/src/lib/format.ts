export const money = (cents: number, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const minutesToTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

export const dateEs = (iso: string | Date | null | undefined) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';
export const dateTimeEs = (iso: string | Date | null | undefined) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';

/** 'YYYY-MM-DD' → '09 nov 2026' */
export function localDateEs(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)));
}

export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const SUB_STATUS: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }> = {
  TRIAL: { label: 'Prueba gratis', tone: 'blue' },
  ACTIVE: { label: 'Activa', tone: 'green' },
  PAST_DUE: { label: 'Pago pendiente', tone: 'amber' },
  GRACE_PERIOD: { label: 'Periodo de gracia', tone: 'amber' },
  SUSPENDED: { label: 'Suspendida', tone: 'red' },
  CANCELED: { label: 'Cancelada', tone: 'gray' },
};

export const EMP_STATUS: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }> = {
  WORKING: { label: 'Trabajando', tone: 'green' },
  OFF: { label: 'Fuera de turno', tone: 'gray' },
  DONE: { label: 'Jornada terminada', tone: 'blue' },
  LATE: { label: 'Retardo', tone: 'amber' },
  INCOMPLETE: { label: 'Jornada incompleta', tone: 'red' },
};

export const SESSION_STATUS: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }> = {
  OPEN: { label: 'En curso', tone: 'green' },
  CLOSED: { label: 'Completa', tone: 'blue' },
  INCOMPLETE: { label: 'Incompleta', tone: 'red' },
};

export const TIMEZONES = [
  ['America/Mexico_City', 'Centro de México'], ['America/Monterrey', 'Monterrey'], ['America/Cancun', 'Cancún'], ['America/Merida', 'Mérida'],
  ['America/Chihuahua', 'Chihuahua'], ['America/Hermosillo', 'Sonora'], ['America/Mazatlan', 'Mazatlán'], ['America/Tijuana', 'Tijuana'],
  ['America/Bogota', 'Colombia'], ['America/Lima', 'Perú'], ['America/Santiago', 'Chile'], ['America/Argentina/Buenos_Aires', 'Argentina'],
  ['America/New_York', 'Nueva York'], ['America/Los_Angeles', 'Los Ángeles'], ['Europe/Madrid', 'España'],
] as const;

/** 7 → "7 días"; 365 → "12 meses". */
export function formatHistory(days: number) {
  if (days >= 60) return `${Math.round(days / 30.4)} meses`;
  return `${days} días`;
}
