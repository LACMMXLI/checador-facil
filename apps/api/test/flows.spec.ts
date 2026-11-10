import { boot, resetDb, TestCtx, registerOwner, createEmployee, linkKiosk, inviteEmployee, newClient, resetLimiter, seedPlatformAdmin } from './helpers';
import { MailService } from '../src/common/mail.service';
import { AttendanceService } from '../src/attendance/attendance.service';

let ctx: TestCtx;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.app.close(); });
beforeEach(async () => { await resetDb(ctx.prisma); resetLimiter(ctx); });

const noGap = (tenantId: string) => ctx.prisma.branch.updateMany({ where: { tenantId }, data: { minPunchGapSeconds: 0 } });

describe('registro y acceso', () => {
  it('registro → correo sin verificar no entra → verificar → entra con prueba activa', async () => {
    const c = newClient(ctx);
    const r = await c.post('/auth/register', { businessName: 'Tacos Uno', name: 'Luis', email: 'luis@prueba.test', password: 'Clave1234x', acceptTerms: true, planCode: 'basico' });
    expect(r.status).toBe(201);
    expect(r.body.requiresVerification).toBe(true);
    const bad = await c.post('/auth/login', { email: 'luis@prueba.test', password: 'Clave1234x' });
    expect(bad.status).toBe(403);
    expect(bad.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const token = new URL(MailService.outbox.get('luis@prueba.test')!.link!).searchParams.get('token')!;
    expect((await c.post('/auth/verify-email', { token })).status).toBe(200);
    expect((await c.post('/auth/verify-email', { token })).status).toBe(400); // un solo uso
    const login = await newClient(ctx).post('/auth/login', { email: 'luis@prueba.test', password: 'Clave1234x' });
    expect(login.status).toBe(200);
    const me = await c.get('/auth/me');
    expect(me.body.subscription.status).toBe('TRIAL');
    expect(me.body.subscription.operational).toBe(true);
  });

  it('exige aceptar términos y contraseña con letras y números', async () => {
    const c = newClient(ctx);
    expect((await c.post('/auth/register', { businessName: 'X1', name: 'Luis', email: 'a@b.test', password: 'Clave1234x', acceptTerms: false })).status).toBe(400);
    expect((await c.post('/auth/register', { businessName: 'X1', name: 'Luis', email: 'a@b.test', password: 'sololetras', acceptTerms: true })).status).toBe(400);
  });

  it('bloquea tras intentos fallidos y no revela si el correo existe', async () => {
    await registerOwner(ctx, 'lock');
    const c = newClient(ctx);
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/auth/login', { email: 'lock@prueba.test', password: 'incorrecta1' });
      expect(r.status).toBe(401);
    }
    const blocked = await c.post('/auth/login', { email: 'lock@prueba.test', password: 'Clave1234x' });
    expect(blocked.status).toBe(429);
    const nouser = await newClient(ctx).post('/auth/login', { email: 'noexiste@prueba.test', password: 'incorrecta1' });
    expect(nouser.body.error.message).toBe('Correo o contraseña incorrectos.');
  });

  it('recuperación de contraseña cierra sesiones anteriores', async () => {
    const o = await registerOwner(ctx, 'rec');
    const f = newClient(ctx);
    expect((await f.post('/auth/forgot', { email: 'rec@prueba.test' })).status).toBe(200);
    const token = new URL(MailService.outbox.get('rec@prueba.test')!.link!).searchParams.get('token')!;
    expect((await f.post('/auth/reset', { token, password: 'NuevaClave99' })).status).toBe(200);
    expect((await o.c.get('/auth/me')).status).toBe(401); // sesión vieja revocada
    expect((await newClient(ctx).post('/auth/login', { email: 'rec@prueba.test', password: 'NuevaClave99' })).status).toBe(200);
  });

  it('CSRF: rechaza peticiones que modifican datos sin el encabezado', async () => {
    const o = await registerOwner(ctx, 'csrf');
    const r = await o.c.agent.post('/api/app/branches').send({ name: 'Otra' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('CSRF');
  });
});

describe('QR dinámico: flujo completo', () => {
  it('entrada y salida automáticas con identidad de la sesión', async () => {
    const o = await registerOwner(ctx, 'qr1');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Ana López');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'ana@prueba.test');

    expect((await e.get('/employee/me')).body.working).toBe(false);
    const q1 = await kiosk.post('/kiosk/qr');
    expect(q1.status).toBe(200);
    expect(q1.body.payload).toMatch(/^RS1\./);
    expect(JSON.stringify(q1.body.payload)).not.toContain('Ana'); // el QR no lleva datos personales

    const in1 = await e.post('/employee/scan', { payload: q1.body.payload, scanId: 'scan-0001-a' });
    expect(in1.status).toBe(200);
    expect(in1.body.type).toBe('IN');
    expect((await e.get('/employee/me')).body.working).toBe(true);

    // El mismo QR sirve a varios empleados / varias veces durante su vigencia
    const q2 = await kiosk.post('/kiosk/qr');
    const out = await e.post('/employee/scan', { payload: q2.body.payload, scanId: 'scan-0002-b' });
    expect(out.body.type).toBe('OUT');

    const hist = await e.get('/employee/history');
    expect(hist.body).toHaveLength(1);
    expect(hist.body[0].status).toBe('CLOSED');

    const rows = (await o.c.get('/app/attendance?range=today')).body.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].employeeName).toBe('Ana López');
  });

  it('reintento con la misma scanId no duplica la checada', async () => {
    const o = await registerOwner(ctx, 'idem');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Beto');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'beto@prueba.test');
    const q = await kiosk.post('/kiosk/qr');
    const a = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'same-scan-id' });
    const b = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'same-scan-id' });
    expect(a.body.type).toBe('IN');
    expect(b.body.duplicate).toBe(true);
    expect(await ctx.prisma.punchEvent.count({ where: { tenantId: o.tenantId } })).toBe(1);
  });

  it('separación mínima entre checadas', async () => {
    const o = await registerOwner(ctx, 'gap');
    const emp = await createEmployee(o, 'Carla');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'carla@prueba.test');
    const q = await kiosk.post('/kiosk/qr');
    expect((await e.post('/employee/scan', { payload: q.body.payload, scanId: 'gap-scan-1' })).status).toBe(200);
    const again = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'gap-scan-2' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TOO_SOON');
  });

  it('QR expirado, inventado o de otro formato se rechaza', async () => {
    const o = await registerOwner(ctx, 'exp');
    const emp = await createEmployee(o, 'Diego');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'diego@prueba.test');
    const q = await kiosk.post('/kiosk/qr');
    await ctx.prisma.qrToken.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });
    const r = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'exp-scan-01' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('QR_EXPIRED');
    expect((await e.post('/employee/scan', { payload: 'RS1.inventado-inventado-inventado', scanId: 'exp-scan-02' })).body.error.code).toBe('QR_INVALID');
    expect((await e.post('/employee/scan', { payload: 'http://phishing.test/xxxxxxxx', scanId: 'exp-scan-03' })).body.error.code).toBe('QR_INVALID');
  });

  it('modo con confirmación: primero muestra, sólo guarda al confirmar', async () => {
    const o = await registerOwner(ctx, 'conf');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Elena');
    await o.c.patch(`/app/branches/${emp.branchId}`, { qrConfirmMode: 'CONFIRM' });
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'elena@prueba.test');
    const q = await kiosk.post('/kiosk/qr');
    const pre = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'conf-scan-1' });
    expect(pre.body.requiresConfirmation).toBe(true);
    expect(pre.body.type).toBe('IN');
    expect(await ctx.prisma.punchEvent.count({ where: { tenantId: o.tenantId } })).toBe(0);
    const ok = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'conf-scan-1', confirm: true });
    expect(ok.body.type).toBe('IN');
    const ev = await ctx.prisma.punchEvent.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(ev.source).toBe('QR_CONFIRM');
  });

  it('empleado inactivo no puede checar y su sesión se revoca', async () => {
    const o = await registerOwner(ctx, 'inact');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Fabián');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'fabian@prueba.test');
    await o.c.patch(`/app/employees/${emp.id}`, { active: false });
    const q = await kiosk.post('/kiosk/qr');
    expect((await e.post('/employee/scan', { payload: q.body.payload, scanId: 'inact-scan-1' })).status).toBe(401);
  });

  it('dispositivo revocado deja de funcionar', async () => {
    const o = await registerOwner(ctx, 'rev');
    const emp = await createEmployee(o, 'Gina');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    expect((await kiosk.post('/kiosk/qr')).status).toBe(200);
    const dev = (await o.c.get('/app/devices')).body[0];
    await o.c.post(`/app/devices/${dev.id}/revoke`);
    const r = await kiosk.post('/kiosk/qr');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('DEVICE_UNLINKED');
  });

  it('el código de vinculación es de un solo uso y caduca', async () => {
    const o = await registerOwner(ctx, 'code');
    const emp = await createEmployee(o, 'Hugo');
    const a = await o.c.post('/app/devices/activation', { branchId: emp.branchId, name: 'T1' });
    expect((await newClient(ctx).post('/kiosk/activate', { code: a.body.code })).status).toBe(200);
    expect((await newClient(ctx).post('/kiosk/activate', { code: a.body.code })).status).toBe(400);
    const b = await o.c.post('/app/devices/activation', { branchId: emp.branchId, name: 'T2' });
    await ctx.prisma.deviceActivation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await newClient(ctx).post('/kiosk/activate', { code: b.body.code })).status).toBe(400);
  });
});

describe('PIN compartido', () => {
  it('registra entrada y salida, y bloquea tras PIN incorrectos repetidos', async () => {
    const o = await registerOwner(ctx, 'pin1');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Iván');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    expect(emp.pin).toMatch(/^\d{6}$/);
    const a = await kiosk.post('/kiosk/pin', { pin: emp.pin });
    expect(a.body.type).toBe('IN');
    const b = await kiosk.post('/kiosk/pin', { pin: emp.pin });
    expect(b.body.type).toBe('OUT');
    const wrong = emp.pin === '000000' ? '000001' : '000000';
    for (let i = 0; i < 6; i++) expect((await kiosk.post('/kiosk/pin', { pin: wrong })).status).toBe(403);
    const locked = await kiosk.post('/kiosk/pin', { pin: emp.pin });
    expect(locked.status).toBe(429); // incluso el PIN correcto queda bloqueado temporalmente
  });

  it('el PIN no se guarda en texto plano y es único por negocio', async () => {
    const o = await registerOwner(ctx, 'pin2');
    const e1 = await createEmployee(o, 'Julia');
    const e2 = await createEmployee(o, 'Kevin');
    expect(e1.pin).not.toBe(e2.pin);
    const rows = await ctx.prisma.employee.findMany({ where: { tenantId: o.tenantId } });
    for (const r of rows) { expect(r.pinLookup).not.toContain(e1.pin); expect(r.pinLookup).toHaveLength(64); }
    const reg = await o.c.post(`/app/employees/${e1.id}/pin`);
    expect(reg.body.pin).toMatch(/^\d{6}$/);
  });

  it('un kiosco en modo QR_ONLY no acepta PIN', async () => {
    const o = await registerOwner(ctx, 'pin3');
    const emp = await createEmployee(o, 'Laura');
    await o.c.patch(`/app/branches/${emp.branchId}`, { punchMode: 'QR_ONLY' });
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    expect((await kiosk.post('/kiosk/pin', { pin: emp.pin })).status).toBe(400);
  });
});

describe('motor de asistencia (servicio)', () => {
  const T = (iso: string) => new Date(iso);
  async function setup(label: string) {
    const o = await registerOwner(ctx, label);
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Nocturno', {
      schedule: [1, 2].map((d) => ({ dayOfWeek: d, isRest: false, startMinutes: 22 * 60, endMinutes: 6 * 60 })),
    });
    return { o, emp, svc: ctx.app.get(AttendanceService) };
  }

  it('turno nocturno lun 22:00 → mar 06:00 = 8 horas, sin retardo, un solo día local', async () => {
    const { o, emp, svc } = await setup('noc1');
    // lunes 2026-11-09 22:00 CDMX = 2026-11-10T04:00Z
    const a = await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: T('2026-11-10T04:00:00Z') });
    const b = await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: T('2026-11-10T12:00:00Z') });
    expect(a.type).toBe('IN'); expect(b.type).toBe('OUT');
    const s = await ctx.prisma.workSession.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(s.workedMinutes).toBe(480);
    expect(s.lateMinutes).toBe(0);
    expect(s.localDate).toBe('2026-11-09'); // pertenece al día local de su entrada
  });

  it('retardo calculado contra la jornada completa', async () => {
    const { o, emp, svc } = await setup('noc2');
    await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: T('2026-11-10T04:30:00Z') }); // 30 min tarde
    const s = await ctx.prisma.workSession.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(s.lateMinutes).toBe(30);
  });

  it('jornada olvidada se marca incompleta sin inventar salida y permite nueva entrada', async () => {
    const { o, emp, svc } = await setup('noc3');
    await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: T('2026-11-10T04:00:00Z') });
    const r = await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: T('2026-11-11T04:00:00Z') }); // 24 h después
    expect(r.type).toBe('IN');
    const sessions = await ctx.prisma.workSession.findMany({ where: { tenantId: o.tenantId }, orderBy: { startAt: 'asc' } });
    expect(sessions[0].status).toBe('INCOMPLETE');
    expect(sessions[0].endAt).toBeNull();
    expect(sessions[1].status).toBe('OPEN');
  });

  it('checadas simultáneas nunca producen dos jornadas abiertas', async () => {
    const { o, emp, svc } = await setup('conc');
    const base = Date.now();
    await Promise.allSettled(Array.from({ length: 8 }, (_, i) => svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: new Date(base + i * 1000), idempotencyKey: `conc-${i}-xxxxxxxx` })));
    const open = await ctx.prisma.workSession.count({ where: { employeeId: emp.id, status: 'OPEN' } });
    expect(open).toBeLessThanOrEqual(1);
    const events = await ctx.prisma.punchEvent.findMany({ where: { employeeId: emp.id }, orderBy: { occurredAt: 'asc' } });
    events.forEach((ev, i) => expect(ev.type).toBe(i % 2 === 0 ? 'IN' : 'OUT')); // alternan estrictamente
  });

  it('la misma clave de idempotencia en paralelo genera un solo evento', async () => {
    const { o, emp, svc } = await setup('conc2');
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', idempotencyKey: 'misma-clave-1234' })));
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await ctx.prisma.punchEvent.count({ where: { employeeId: emp.id } })).toBe(1);
  });

  it('la base de datos impide dos jornadas abiertas y la edición de eventos', async () => {
    const { o, emp } = await setup('db');
    const base = { tenantId: o.tenantId, employeeId: emp.id, branchId: emp.branchId, localDate: '2026-11-09', status: 'OPEN' as const };
    await ctx.prisma.workSession.create({ data: { ...base, startAt: new Date() } });
    await expect(ctx.prisma.workSession.create({ data: { ...base, startAt: new Date(Date.now() + 1000) } })).rejects.toThrow();
    const ev = await ctx.prisma.punchEvent.create({ data: { tenantId: o.tenantId, employeeId: emp.id, branchId: emp.branchId, source: 'PIN', type: 'IN', occurredAt: new Date(), idempotencyKey: 'inmutable-1' } });
    await expect(ctx.prisma.punchEvent.update({ where: { id: ev.id }, data: { type: 'OUT' } })).rejects.toThrow(/inmutable/);
    await expect(ctx.prisma.punchEvent.delete({ where: { id: ev.id } })).rejects.toThrow(/inmutable/);
  });
});

describe('correcciones auditadas', () => {
  it('conserva valor anterior, nuevo, motivo y responsable; recalcula horas', async () => {
    const o = await registerOwner(ctx, 'corr');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Mario');
    const svc = ctx.app.get(AttendanceService);
    const t0 = new Date(Date.now() - 10 * 3600_000);
    await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: t0 });
    await svc.punch({ tenantId: o.tenantId, employeeId: emp.id, source: 'PIN', now: new Date(t0.getTime() + 4 * 3600_000) });
    const s = await ctx.prisma.workSession.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(s.workedMinutes).toBe(240);

    const noReason = await o.c.post(`/app/attendance/${s.id}/correct`, { startAt: t0, endAt: new Date(t0.getTime() + 8 * 3600_000), reason: '' });
    expect(noReason.status).toBe(400);
    const ok = await o.c.post(`/app/attendance/${s.id}/correct`, { startAt: t0, endAt: new Date(t0.getTime() + 8 * 3600_000), reason: 'Olvidó checar la salida' });
    expect(ok.status).toBe(200);
    expect(ok.body.workedMinutes).toBe(480);
    const adj = (await o.c.get(`/app/attendance/${s.id}/adjustments`)).body;
    expect(adj).toHaveLength(1);
    expect(adj[0].reason).toBe('Olvidó checar la salida');
    expect(new Date(adj[0].oldEndAt).getTime()).toBe(t0.getTime() + 4 * 3600_000);
    expect(adj[0].userId).toBe(o.userId);
    expect(await ctx.prisma.punchEvent.count({ where: { tenantId: o.tenantId } })).toBe(2); // eventos originales intactos
    // no se permiten horas en el futuro
    const fut = await o.c.post(`/app/attendance/${s.id}/correct`, { startAt: t0, endAt: new Date(Date.now() + 5 * 3600_000), reason: 'prueba futuro' });
    expect(fut.status).toBe(400);
  });

  it('acepta horas locales de la sucursal (zona horaria) en alta manual y corrección', async () => {
    const o = await registerOwner(ctx, 'local');
    const emp = await createEmployee(o, 'Pablo');
    const r = await o.c.post('/app/attendance/manual', { employeeId: emp.id, startLocal: '2026-11-09 22:00', endLocal: '2026-11-10 06:00', reason: 'Turno nocturno olvidado' });
    expect(r.status).toBe(201);
    const s = await ctx.prisma.workSession.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(s.startAt.toISOString()).toBe('2026-11-10T04:00:00.000Z'); // 22:00 CDMX = 04:00Z
    expect(s.workedMinutes).toBe(480);
    expect(s.localDate).toBe('2026-11-09');
    const fix = await o.c.post(`/app/attendance/${s.id}/correct`, { startLocal: '2026-11-09 22:00', endLocal: '2026-11-10 05:00', reason: 'Salió una hora antes' });
    expect(fix.status).toBe(200);
    expect(fix.body.workedMinutes).toBe(420);
    expect((await o.c.post(`/app/attendance/${s.id}/correct`, { startLocal: 'mañana', reason: 'mal formato' })).status).toBe(400);
  });

  it('alta manual de jornada olvidada y rechazo de empalmes', async () => {
    const o = await registerOwner(ctx, 'man');
    const emp = await createEmployee(o, 'Nora');
    const start = new Date(Date.now() - 30 * 3600_000);
    const end = new Date(start.getTime() + 6 * 3600_000);
    const r = await o.c.post('/app/attendance/manual', { employeeId: emp.id, startAt: start, endAt: end, reason: 'Se cayó el internet' });
    expect(r.status).toBe(201);
    const clash = await o.c.post('/app/attendance/manual', { employeeId: emp.id, startAt: new Date(start.getTime() + 3600_000), endAt: new Date(end.getTime() + 3600_000), reason: 'empalme' });
    expect(clash.status).toBe(409);
  });
});

describe('reportes', () => {
  it('exporta CSV con BOM y protege contra inyección de fórmulas', async () => {
    const o = await registerOwner(ctx, 'csv');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, '=HYPERLINK("http://x")');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    await kiosk.post('/kiosk/pin', { pin: emp.pin });
    const r = await o.c.get('/app/attendance/export.csv?range=today');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
    expect(r.text).toContain("'=HYPERLINK");
    expect(r.text.split('\r\n')[0]).toContain('Empleado');
  });

  it('tablero muestra estados y contadores', async () => {
    const o = await registerOwner(ctx, 'dash');
    await noGap(o.tenantId);
    const a = await createEmployee(o, 'Oscar');
    await createEmployee(o, 'Paula');
    const kiosk = await linkKiosk(ctx, o, a.branchId);
    await kiosk.post('/kiosk/pin', { pin: a.pin });
    const d = (await o.c.get('/app/dashboard')).body;
    expect(d.activeEmployees).toBe(2);
    expect(d.working).toBe(1);
    expect(d.employees.find((e: { name: string }) => e.name === 'Oscar').status).toBe('WORKING');
    expect(d.employees.find((e: { name: string }) => e.name === 'Paula').status).toBe('OFF');
  });
});

describe('aislamiento entre negocios', () => {
  it('un negocio no ve ni toca datos de otro', async () => {
    const A = await registerOwner(ctx, 'isoA');
    const B = await registerOwner(ctx, 'isoB');
    await noGap(A.tenantId); await noGap(B.tenantId);
    const ea = await createEmployee(A, 'Empleado A');
    const eb = await createEmployee(B, 'Empleado B');
    const kioskA = await linkKiosk(ctx, A, ea.branchId);
    await kioskA.post('/kiosk/pin', { pin: ea.pin });

    // listados
    expect((await B.c.get('/app/employees')).body.map((e: { name: string }) => e.name)).toEqual(['Empleado B']);
    expect((await B.c.get('/app/attendance?range=month')).body.rows).toHaveLength(0);
    expect((await B.c.get('/app/devices')).body).toHaveLength(0);
    // acceso directo por id → 404, no 403 (no revela existencia)
    expect((await B.c.get(`/app/employees/${ea.id}`)).status).toBe(404);
    expect((await B.c.patch(`/app/employees/${ea.id}`, { name: 'Hackeado' })).status).toBe(404);
    expect((await B.c.post(`/app/employees/${ea.id}/pin`)).status).toBe(404);
    expect((await B.c.put(`/app/employees/${ea.id}/schedule`, { schedule: [] })).status).toBe(404);
    expect((await B.c.patch(`/app/branches/${ea.branchId}`, { name: 'Hackeada' })).status).toBe(404);
    const sessA = await ctx.prisma.workSession.findFirstOrThrow({ where: { tenantId: A.tenantId } });
    expect((await B.c.post(`/app/attendance/${sessA.id}/correct`, { startAt: new Date(Date.now() - 3600_000), endAt: null, reason: 'intento cruzado' })).status).toBe(404);
    expect((await B.c.get(`/app/attendance/${sessA.id}/adjustments`)).status).toBe(404);
    const devA = (await A.c.get('/app/devices')).body[0];
    expect((await B.c.post(`/app/devices/${devA.id}/revoke`)).status).toBe(404);
    // crear empleado de B en sucursal de A
    const cross = await B.c.post('/app/employees', { name: 'Intruso', branchId: ea.branchId });
    expect(cross.status).toBe(400);
    // CSV sólo con sus datos
    const csv = await B.c.get('/app/attendance/export.csv?range=month');
    expect(csv.text).not.toContain('Empleado A');
    // nada cambió en A
    expect((await ctx.prisma.employee.findUniqueOrThrow({ where: { id: ea.id } })).name).toBe('Empleado A');
    expect((await ctx.prisma.branch.findUniqueOrThrow({ where: { id: ea.branchId } })).name).toBe('Sucursal principal');
    // PIN de A no sirve en kiosco de B y viceversa (el índice del PIN depende del tenant)
    const kioskB = await linkKiosk(ctx, B, eb.branchId);
    const crossPin = await kioskB.post('/kiosk/pin', { pin: ea.pin === eb.pin ? '999999' : ea.pin });
    expect(crossPin.status).toBe(403);
  });

  it('un empleado de B no puede checar con el QR de A', async () => {
    const A = await registerOwner(ctx, 'qrA');
    const B = await registerOwner(ctx, 'qrB');
    const ea = await createEmployee(A, 'Ea');
    const eb = await createEmployee(B, 'Eb');
    const kioskA = await linkKiosk(ctx, A, ea.branchId);
    const empB = await inviteEmployee(ctx, B, eb.id, 'eb@prueba.test');
    const q = await kioskA.post('/kiosk/qr');
    const r = await empB.post('/employee/scan', { payload: q.body.payload, scanId: 'cross-scan-1' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('QR_INVALID');
    expect(await ctx.prisma.punchEvent.count()).toBe(0);
  });

  it('un empleado sólo puede checar en la sucursal a la que pertenece', async () => {
    const o = await registerOwner(ctx, 'suc');
    await ctx.prisma.plan.updateMany({ data: { maxBranches: 3 } });
    const b2 = await o.c.post('/app/branches', { name: 'Sucursal Norte' });
    expect(b2.status).toBe(201);
    const emp = await createEmployee(o, 'Rita');
    const kioskNorte = await linkKiosk(ctx, o, b2.body.id);
    const e = await inviteEmployee(ctx, o, emp.id, 'rita@prueba.test');
    const q = await kioskNorte.post('/kiosk/qr');
    const r = await e.post('/employee/scan', { payload: q.body.payload, scanId: 'wrongbranch-1' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('WRONG_BRANCH');
    expect((await kioskNorte.post('/kiosk/pin', { pin: emp.pin })).status).toBe(403);
  });

  it('las sesiones no se pueden usar entre tipos de usuario', async () => {
    const o = await registerOwner(ctx, 'tipo');
    expect((await o.c.get('/platform/metrics')).status).toBe(401);
    expect((await o.c.get('/employee/me')).status).toBe(401);
    expect((await o.c.get('/kiosk/state')).status).toBe(401);
    expect((await newClient(ctx).get('/app/employees')).status).toBe(401);
  });
});

describe('límites del plan y suscripción', () => {
  it('el backend impone el límite de empleados y sucursales', async () => {
    const o = await registerOwner(ctx, 'lim');
    await ctx.prisma.plan.updateMany({ where: { code: 'basico' }, data: { maxEmployees: 2 } });
    await createEmployee(o, 'Uno'); await createEmployee(o, 'Dos');
    const third = await o.c.post('/app/employees', { name: 'Tres', branchId: (await o.c.get('/app/branches')).body[0].id });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('PLAN_LIMIT_EMPLOYEES');
    const br = await o.c.post('/app/branches', { name: 'Otra' });
    expect(br.status).toBe(409);
    expect(br.body.error.code).toBe('PLAN_LIMIT_BRANCHES');
  });

  it('suspensión: se puede consultar y exportar, pero no checar ni editar; renovar la reactiva', async () => {
    const o = await registerOwner(ctx, 'susp');
    await noGap(o.tenantId);
    const emp = await createEmployee(o, 'Sara');
    const kiosk = await linkKiosk(ctx, o, emp.branchId);
    const e = await inviteEmployee(ctx, o, emp.id, 'sara@prueba.test');
    await kiosk.post('/kiosk/pin', { pin: emp.pin }); // una checada previa

    const admin = await seedPlatformAdmin(ctx);
    expect((await admin.post(`/platform/tenants/${o.tenantId}/status`, { status: 'SUSPENDED' })).status).toBe(200);

    // sigue pudiendo consultar y exportar (los datos no se pierden)
    expect((await o.c.get('/app/employees')).status).toBe(200);
    expect((await o.c.get('/app/attendance?range=today')).body.rows).toHaveLength(1);
    expect((await o.c.get('/app/attendance/export.csv?range=today')).status).toBe(200);
    expect((await o.c.get('/app/subscription')).body.status).toBe('SUSPENDED');
    // pero no puede escribir ni checar
    const w = await o.c.post('/app/employees', { name: 'Nuevo', branchId: emp.branchId });
    expect(w.status).toBe(402);
    expect(w.body.error.code).toBe('SUBSCRIPTION_SUSPENDED');
    expect((await kiosk.post('/kiosk/pin', { pin: emp.pin })).status).toBe(402);
    expect((await kiosk.post('/kiosk/qr')).status).toBe(402);
    expect((await e.get('/employee/me')).body.operational).toBe(false);

    // el cliente reporta su pago y el admin lo aprueba
    const rep = await o.c.post('/app/subscription/payments', { months: 1, reference: 'SPEI 123' });
    expect(rep.status).toBe(201);
    expect((await o.c.get('/app/subscription')).body.status).toBe('SUSPENDED'); // reportar no activa
    expect((await admin.post(`/platform/payments/${rep.body.id}/approve`)).status).toBe(200);
    expect((await admin.post(`/platform/payments/${rep.body.id}/approve`)).status).toBe(409); // no se aplica dos veces
    const sub = (await o.c.get('/app/subscription')).body;
    expect(sub.status).toBe('ACTIVE');
    expect(sub.daysLeft).toBeGreaterThanOrEqual(27);
    expect((await o.c.post('/app/employees', { name: 'Nuevo', branchId: emp.branchId })).status).toBe(201);
  });

  it('el monto de un pago lo fija el servidor, no el cliente', async () => {
    const o = await registerOwner(ctx, 'monto');
    const r = await o.c.post('/app/subscription/payments', { months: 2, amountCents: 1 });
    expect(r.status).toBe(201);
    const p = await ctx.prisma.payment.findFirstOrThrow({ where: { tenantId: o.tenantId } });
    expect(p.amountCents).toBe(14900 * 2);
  });

  it('prueba vencida entra en gracia y luego se suspende', async () => {
    const o = await registerOwner(ctx, 'gracia');
    const past = (d: number) => new Date(Date.now() - d * 86_400_000);
    await ctx.prisma.subscription.update({ where: { tenantId: o.tenantId }, data: { trialEndsAt: past(1), graceDays: 3 } });
    expect((await o.c.get('/app/subscription')).body.status).toBe('GRACE_PERIOD');
    expect((await o.c.post('/app/branches', { name: 'x1' })).status).not.toBe(402); // sigue operando en gracia
    await ctx.prisma.subscription.update({ where: { tenantId: o.tenantId }, data: { trialEndsAt: past(10) } });
    expect((await o.c.get('/app/subscription')).body.status).toBe('SUSPENDED');
  });
});

describe('panel SaaS', () => {
  it('login separado, auditoría de renovaciones, planes editables y pública', async () => {
    const o = await registerOwner(ctx, 'plat');
    const admin = await seedPlatformAdmin(ctx);
    const list = (await admin.get('/platform/tenants')).body;
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('TRIAL');

    const renew = await admin.post(`/platform/tenants/${o.tenantId}/renew`, { months: 3 });
    expect(renew.status).toBe(200);
    expect((await admin.post(`/platform/tenants/${o.tenantId}/grant-days`, { days: 5 })).status).toBe(200);
    const detail = (await admin.get(`/platform/tenants/${o.tenantId}`)).body;
    expect(detail.audit.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['subscription.renew', 'subscription.grant_days']));
    expect(detail.subscription.status).toBe('ACTIVE');

    // precio editable sin tocar código, y se refleja en la página pública
    const plans = (await admin.get('/platform/plans')).body;
    const basic = plans.find((p: { code: string }) => p.code === 'basico');
    expect((await admin.patch(`/platform/plans/${basic.id}`, { priceMonthlyCents: 19900 })).status).toBe(200);
    const pub = (await newClient(ctx).get('/public/plans')).body;
    expect(pub.find((p: { code: string }) => p.code === 'basico').priceMonthlyCents).toBe(19900);
    expect(JSON.stringify(pub)).not.toContain('id"');

    const m = (await admin.get('/platform/metrics')).body;
    expect(m.tenants).toBe(1); expect(m.active).toBe(1);
    expect(m.revenueTotalCents).toBe(0); // renovar sin pago no inventa ingresos

    const pay = await admin.post(`/platform/tenants/${o.tenantId}/payments`, { amountCents: 14900, months: 1, reference: 'efectivo' });
    expect(pay.status).toBe(201);
    expect((await admin.get('/platform/metrics')).body.revenueTotalCents).toBe(14900);

    expect((await admin.post('/platform/logout')).status).toBe(200);
    expect((await admin.get('/platform/metrics')).status).toBe(401);
  });

  it('MFA: con TOTP activado, la contraseña sola no da acceso', async () => {
    const admin = await seedPlatformAdmin(ctx);
    const setup = await admin.post('/platform/mfa/setup');
    const { totpAt } = await import('../src/common/totp');
    const en = await admin.post('/platform/mfa/enable', { code: totpAt(setup.body.secret, Date.now()) });
    expect(en.status).toBe(200);
    const c2 = newClient(ctx);
    const login = await c2.post('/platform/login', { email: 'admin@prueba.test', password: 'AdminClave1234' });
    expect(login.body.mfaRequired).toBe(true);
    expect((await c2.get('/platform/metrics')).status).toBe(401);
    expect((await c2.post('/platform/mfa/verify', { code: '000000' })).status).toBe(401);
    expect((await c2.post('/platform/mfa/verify', { code: totpAt(setup.body.secret, Date.now()) })).status).toBe(200);
    expect((await c2.get('/platform/metrics')).status).toBe(200);
  });

  it('el negocio puede ser creado por el administrador y entrar con contraseña temporal', async () => {
    const admin = await seedPlatformAdmin(ctx);
    const r = await admin.post('/platform/tenants', { businessName: 'Panadería Sol', ownerName: 'Marta', ownerEmail: 'marta@prueba.test', planCode: 'negocio' });
    expect(r.status).toBe(201);
    const login = await newClient(ctx).post('/auth/login', { email: 'marta@prueba.test', password: r.body.tempPassword });
    expect(login.status).toBe(200);
  });
});
