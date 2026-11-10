import {
  computeMetrics, resolveShift, shiftStartingOn, localDateString, localToUtc, isStale, nextPunchType,
  respectsMinGap, displayStatus, workedMinutes, addDaysToLocalDate, dayOfWeekOf, ScheduleDay,
} from './engine';

const TZ = 'America/Mexico_City'; // UTC-6 sin horario de verano desde 2022
const d = (iso: string) => new Date(iso);

// Lunes (1) y martes (2) 16:00–01:00, miércoles (3) descanso, jue–sáb 09:00–17:00, domingo descanso
const sched: ScheduleDay[] = [
  { dayOfWeek: 0, isRest: true, startMinutes: 0, endMinutes: 0 },
  { dayOfWeek: 1, isRest: false, startMinutes: 16 * 60, endMinutes: 60 },
  { dayOfWeek: 2, isRest: false, startMinutes: 16 * 60, endMinutes: 60 },
  { dayOfWeek: 3, isRest: true, startMinutes: 0, endMinutes: 0 },
  { dayOfWeek: 4, isRest: false, startMinutes: 9 * 60, endMinutes: 17 * 60 },
  { dayOfWeek: 5, isRest: false, startMinutes: 9 * 60, endMinutes: 17 * 60 },
  { dayOfWeek: 6, isRest: false, startMinutes: 9 * 60, endMinutes: 17 * 60 },
];

describe('zona horaria', () => {
  it('convierte local a UTC y viceversa', () => {
    const u = localToUtc(2026, 11, 9, 16 * 60, TZ); // lunes 16:00 CDMX
    expect(u.toISOString()).toBe('2026-11-09T22:00:00.000Z');
    expect(localDateString(u, TZ)).toBe('2026-11-09');
  });
  it('un instante UTC de madrugada pertenece al día local anterior', () => {
    expect(localDateString(d('2026-11-10T03:30:00Z'), TZ)).toBe('2026-11-09');
  });
  it('maneja cambio de horario de verano (Nueva York)', () => {
    const ny = 'America/New_York';
    expect(localToUtc(2026, 3, 8, 12 * 60, ny).toISOString()).toBe('2026-03-08T16:00:00.000Z');
    expect(localToUtc(2026, 3, 7, 12 * 60, ny).toISOString()).toBe('2026-03-07T17:00:00.000Z');
  });
  it('calcula día de la semana y suma días', () => {
    expect(dayOfWeekOf('2026-11-09')).toBe(1);
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('turnos', () => {
  it('turno nocturno termina al día siguiente', () => {
    const sh = shiftStartingOn(sched, '2026-11-09', TZ)!;
    expect(sh.start.toISOString()).toBe('2026-11-09T22:00:00.000Z');
    expect(sh.end.toISOString()).toBe('2026-11-10T07:00:00.000Z');
  });
  it('descanso no tiene turno', () => {
    expect(shiftStartingOn(sched, '2026-11-11', TZ)).toBeNull();
  });
  it('entrada de madrugada del martes se asocia al turno del lunes', () => {
    const sh = resolveShift(sched, d('2026-11-10T06:30:00Z'), TZ);
    expect(sh?.localDate).toBe('2026-11-09');
  });
  it('entrada del martes por la tarde usa el turno del martes', () => {
    const sh = resolveShift(sched, localToUtc(2026, 11, 10, 15 * 60 + 30, TZ), TZ);
    expect(sh?.localDate).toBe('2026-11-10');
  });
  it('sin horarios no hay turno', () => {
    expect(resolveShift([], d('2026-11-09T22:00:00Z'), TZ)).toBeNull();
  });
});

describe('métricas', () => {
  const sh = shiftStartingOn(sched, '2026-11-09', TZ)!; // 22:00Z -> 07:00Z
  it('dentro de tolerancia no hay retardo', () => {
    expect(computeMetrics(d('2026-11-09T22:09:00Z'), d('2026-11-10T07:00:00Z'), sh, 10, 0).lateMinutes).toBe(0);
  });
  it('fuera de tolerancia cuenta todos los minutos', () => {
    expect(computeMetrics(d('2026-11-09T22:25:00Z'), d('2026-11-10T07:00:00Z'), sh, 10, 0).lateMinutes).toBe(25);
  });
  it('turno nocturno 22:00–06:00 = 8 horas', () => {
    expect(workedMinutes(d('2026-11-10T04:00:00Z'), d('2026-11-10T12:00:00Z'))).toBe(480);
  });
  it('salida anticipada', () => {
    const m = computeMetrics(d('2026-11-09T22:00:00Z'), d('2026-11-10T06:00:00Z'), sh, 10, 5);
    expect(m.earlyLeaveMinutes).toBe(60);
    expect(m.workedMinutes).toBe(480);
  });
  it('sin turno programado no hay retardo ni salida anticipada', () => {
    const m = computeMetrics(d('2026-11-09T22:25:00Z'), d('2026-11-10T01:00:00Z'), null, 10, 0);
    expect(m).toEqual({ lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 155 });
  });
  it('jornada abierta no suma horas', () => {
    expect(workedMinutes(d('2026-11-09T22:00:00Z'), null)).toBe(0);
  });
});

import { rangeFor, formatLocal } from './engine';

describe('rangos de reporte', () => {
  it('semana de lunes a domingo', () => {
    expect(rangeFor('week', '2026-11-12')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(rangeFor('week', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' }); // domingo
  });
  it('quincenas y mes', () => {
    expect(rangeFor('fortnight', '2026-11-10')).toEqual({ from: '2026-11-01', to: '2026-11-15' });
    expect(rangeFor('fortnight', '2026-02-20')).toEqual({ from: '2026-02-16', to: '2026-02-28' });
    expect(rangeFor('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('ayer cruza de mes', () => {
    expect(rangeFor('yesterday', '2026-12-01')).toEqual({ from: '2026-11-30', to: '2026-11-30' });
  });
  it('formato local', () => {
    expect(formatLocal(new Date('2026-11-10T03:30:00Z'), 'America/Mexico_City')).toBe('2026-11-09 21:30');
  });
});

describe('reglas de checada', () => {
  it('alterna entrada/salida', () => {
    expect(nextPunchType(false)).toBe('IN');
    expect(nextPunchType(true)).toBe('OUT');
  });
  it('separación mínima', () => {
    const a = d('2026-11-09T22:00:00Z');
    expect(respectsMinGap(a, d('2026-11-09T22:00:30Z'), 60)).toBe(false);
    expect(respectsMinGap(a, d('2026-11-09T22:01:00Z'), 60)).toBe(true);
    expect(respectsMinGap(null, a, 60)).toBe(true);
  });
  it('jornada olvidada se marca incompleta tras el límite', () => {
    const s = d('2026-11-09T22:00:00Z');
    expect(isStale(s, d('2026-11-10T13:59:00Z'), 16)).toBe(false);
    expect(isStale(s, d('2026-11-10T14:01:00Z'), 16)).toBe(true);
  });
  it('estado de tablero', () => {
    expect(displayStatus(null)).toBe('OFF');
    expect(displayStatus({ status: 'OPEN', lateMinutes: 0 })).toBe('WORKING');
    expect(displayStatus({ status: 'OPEN', lateMinutes: 15 })).toBe('LATE');
    expect(displayStatus({ status: 'CLOSED', lateMinutes: 0 })).toBe('DONE');
    expect(displayStatus({ status: 'INCOMPLETE', lateMinutes: 0 })).toBe('INCOMPLETE');
  });
});
