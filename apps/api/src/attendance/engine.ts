/**
 * Motor de asistencia — funciones PURAS (sin base de datos, sin reloj del sistema).
 * Todos los instantes son Date (UTC). La zona horaria sólo se usa para interpretar
 * horarios locales de la sucursal.
 */

export interface ScheduleDay {
  dayOfWeek: number; // 0 = domingo … 6 = sábado (día local en que INICIA el turno)
  isRest: boolean;
  startMinutes: number; // minutos desde 00:00 local
  endMinutes: number; // si <= startMinutes el turno termina al día siguiente
}

export interface Shift {
  localDate: string; // YYYY-MM-DD del día en que inicia el turno
  start: Date;
  end: Date;
}

export type SessionKind = 'OPEN' | 'CLOSED' | 'INCOMPLETE';

const MIN = 60_000;
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz: string): boolean {
  try { fmt(tz); return true; } catch { return false; }
}

export interface LocalParts { y: number; m: number; d: number; h: number; mi: number; s: number; }

export function localParts(instant: Date, tz: string): LocalParts {
  const o: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(instant)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDateString(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function offsetMs(utcMs: number, tz: string): number {
  const p = localParts(new Date(utcMs), tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Convierte (año, mes, día, minutos-desde-medianoche) locales a un instante UTC. */
export function localToUtc(y: number, m: number, d: number, minutes: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0) + minutes * MIN;
  const off1 = offsetMs(guess, tz);
  let t = guess - off1;
  const off2 = offsetMs(t, tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

export function parseLocalDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function addDaysToLocalDate(s: string, days: number): string {
  const { y, m, d } = parseLocalDate(s);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dayOfWeekOf(localDate: string): number {
  const { y, m, d } = parseLocalDate(localDate);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Turno que INICIA en `localDate` (null si es descanso o no hay horario). */
export function shiftStartingOn(schedules: ScheduleDay[], localDate: string, tz: string): Shift | null {
  const dow = dayOfWeekOf(localDate);
  const s = schedules.find((x) => x.dayOfWeek === dow);
  if (!s || s.isRest) return null;
  const { y, m, d } = parseLocalDate(localDate);
  const start = localToUtc(y, m, d, s.startMinutes, tz);
  const crosses = s.endMinutes <= s.startMinutes;
  const end = localToUtc(y, m, d, s.endMinutes + (crosses ? 1440 : 0), tz);
  return { localDate, start, end };
}

/**
 * Turno programado al que corresponde una entrada: el turno (de ayer, hoy o mañana)
 * cuyo inicio queda más cerca de la entrada, a no más de 12 horas, y que no haya terminado.
 */
export function resolveShift(schedules: ScheduleDay[], entry: Date, tz: string): Shift | null {
  if (!schedules.length) return null;
  const today = localDateString(entry, tz);
  let best: Shift | null = null;
  let bestDiff = Infinity;
  for (const off of [-1, 0, 1]) {
    const sh = shiftStartingOn(schedules, addDaysToLocalDate(today, off), tz);
    if (!sh) continue;
    if (entry.getTime() > sh.end.getTime()) continue;
    const diff = Math.abs(entry.getTime() - sh.start.getTime());
    if (diff <= 12 * 60 * MIN && diff < bestDiff) { best = sh; bestDiff = diff; }
  }
  return best;
}

export interface Metrics {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
}

export function workedMinutes(start: Date, end: Date | null): number {
  if (!end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MIN));
}

/** Retardo: minutos tras el inicio programado, sólo si exceden la tolerancia. */
export function lateMinutes(start: Date, shift: Shift | null, toleranceMin: number): number {
  if (!shift) return 0;
  const late = Math.floor((start.getTime() - shift.start.getTime()) / MIN);
  return late > toleranceMin ? late : 0;
}

/** Salida anticipada: minutos antes del fin programado, sólo si exceden la tolerancia. */
export function earlyLeaveMinutes(end: Date | null, shift: Shift | null, toleranceMin: number): number {
  if (!shift || !end) return 0;
  const early = Math.floor((shift.end.getTime() - end.getTime()) / MIN);
  return early > toleranceMin ? early : 0;
}

export function computeMetrics(
  start: Date, end: Date | null, shift: Shift | null, lateTol: number, earlyTol: number,
): Metrics {
  return {
    lateMinutes: lateMinutes(start, shift, lateTol),
    earlyLeaveMinutes: earlyLeaveMinutes(end, shift, earlyTol),
    workedMinutes: workedMinutes(start, end),
  };
}

/** ¿Una jornada abierta debe marcarse incompleta por exceder el límite? */
export function isStale(start: Date, now: Date, maxOpenHours: number): boolean {
  return now.getTime() - start.getTime() > maxOpenHours * 60 * MIN;
}

/** Tipo de la siguiente checada según haya o no jornada abierta. */
export function nextPunchType(hasOpenSession: boolean): 'IN' | 'OUT' {
  return hasOpenSession ? 'OUT' : 'IN';
}

/** ¿Se respeta la separación mínima entre checadas? */
export function respectsMinGap(last: Date | null, now: Date, minGapSeconds: number): boolean {
  if (!last) return true;
  return now.getTime() - last.getTime() >= minGapSeconds * 1000;
}

export type DisplayStatus = 'WORKING' | 'OFF' | 'DONE' | 'LATE' | 'INCOMPLETE';

/** Estado mostrado en el tablero para un empleado, dada su jornada más relevante. */
export function displayStatus(session: { status: SessionKind; lateMinutes: number } | null): DisplayStatus {
  if (!session) return 'OFF';
  if (session.status === 'INCOMPLETE') return 'INCOMPLETE';
  if (session.status === 'OPEN') return session.lateMinutes > 0 ? 'LATE' : 'WORKING';
  return 'DONE';
}

/** 'YYYY-MM-DD HH:mm' en hora local de la sucursal. */
export function formatLocal(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

export type RangePreset = 'today' | 'yesterday' | 'week' | 'fortnight' | 'month';

/** Rango (fechas locales, inclusivo) para un preset, dado el "hoy" local. Semana = lunes a domingo. */
export function rangeFor(preset: RangePreset, today: string): { from: string; to: string } {
  const { y, m, d } = parseLocalDate(today);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const t = addDaysToLocalDate(today, -1); return { from: t, to: t }; }
    case 'week': {
      const dow = dayOfWeekOf(today);
      const monday = addDaysToLocalDate(today, -((dow + 6) % 7));
      return { from: monday, to: addDaysToLocalDate(monday, 6) };
    }
    case 'fortnight':
      return d <= 15
        ? { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-15` }
        : { from: `${y}-${pad(m)}-16`, to: `${y}-${pad(m)}-${pad(lastDay)}` };
    case 'month': return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` };
  }
}

/** Inicio y fin UTC de un día local completo (para filtros de rango). */
export function localDayBounds(localDate: string, tz: string): { from: Date; to: Date } {
  const { y, m, d } = parseLocalDate(localDate);
  return { from: localToUtc(y, m, d, 0, tz), to: localToUtc(y, m, d, 1440, tz) };
}
