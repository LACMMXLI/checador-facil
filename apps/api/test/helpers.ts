import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://reloj:reloj_dev_2027@localhost:5432/reloj_saas_test?schema=public';
process.env.APP_SECRET = 'test-secret-test-secret-test-secret-test-secret-1234';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.PLATFORM_REQUIRE_MFA = 'false';
process.env.SMTP_HOST = '';

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/common/prisma.service';
import { MailService } from '../src/common/mail.service';
import { FailLimiter } from '../src/common/rate-limiter';
import { hashPassword } from '../src/common/crypto';
import { DEFAULT_PLANS } from '../prisma/plans';

export interface TestCtx { app: INestApplication; prisma: PrismaService; http: () => ReturnType<typeof request.agent> }

export async function boot(): Promise<TestCtx> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma, http: () => request.agent(app.getHttpServer()) };
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "AuditLog","AttendanceAdjustment","WorkSession","PunchEvent","WorkSchedule","QrToken","DeviceActivation","Device","EmployeeAccount","Employee","Payment","Subscription","Branch","Membership","Tenant","VerificationToken","AuthSession","User","PlatformAdmin","PlatformSetting","Plan" RESTART IDENTITY CASCADE`);
  for (const p of DEFAULT_PLANS) await prisma.plan.create({ data: p });
  MailService.outbox.clear();
}

export const H = { 'X-Requested-With': 'reloj' };

/** Agente HTTP con cookies y encabezado CSRF por defecto. */
export class Client {
  constructor(public agent: ReturnType<typeof request.agent>) {}
  get(url: string) { return this.agent.get('/api' + url); }
  post(url: string, body: object = {}) { return this.agent.post('/api' + url).set(H).send(body); }
  patch(url: string, body: object = {}) { return this.agent.patch('/api' + url).set(H).send(body); }
  put(url: string, body: object = {}) { return this.agent.put('/api' + url).set(H).send(body); }
}

export function newClient(ctx: TestCtx) { return new Client(ctx.http()); }

let seq = 0;
/** Registra un negocio, verifica el correo e inicia sesión. */
export async function registerOwner(ctx: TestCtx, label = `n${++seq}`) {
  const c = newClient(ctx);
  const email = `${label}@prueba.test`.toLowerCase();
  const r = await c.post('/auth/register', { businessName: `Negocio ${label}`, name: `Dueño ${label}`, email, password: 'Clave1234x', acceptTerms: true, planCode: 'basico' });
  if (r.status !== 201) throw new Error('register falló: ' + JSON.stringify(r.body));
  const link = MailService.outbox.get(email)!.link!;
  const token = new URL(link).searchParams.get('token')!;
  const v = await c.post('/auth/verify-email', { token });
  if (v.status !== 200) throw new Error('verify falló: ' + JSON.stringify(v.body));
  const me = await c.get('/auth/me');
  return { c, email, tenantId: me.body.tenant.id as string, userId: me.body.user.id as string };
}

export async function createEmployee(owner: { c: Client }, name: string, extra: object = {}) {
  const branches = (await owner.c.get('/app/branches')).body;
  const r = await owner.c.post('/app/employees', { name, branchId: branches[0].id, ...extra });
  if (r.status !== 201) throw new Error('crear empleado falló: ' + JSON.stringify(r.body));
  return { id: r.body.id as string, pin: r.body.pin as string, branchId: branches[0].id as string };
}

/** Vincula un dispositivo kiosco y devuelve su cliente (con cookie de dispositivo). */
export async function linkKiosk(ctx: TestCtx, owner: { c: Client }, branchId: string) {
  const a = await owner.c.post('/app/devices/activation', { branchId, name: 'Tableta' });
  if (a.status !== 201) throw new Error('activation falló: ' + JSON.stringify(a.body));
  const k = newClient(ctx);
  const r = await k.post('/kiosk/activate', { code: a.body.code });
  if (r.status !== 200) throw new Error('activate falló: ' + JSON.stringify(r.body));
  return k;
}

export async function inviteEmployee(ctx: TestCtx, owner: { c: Client }, employeeId: string, email: string, password = 'Clave1234x') {
  const inv = await owner.c.post(`/app/employees/${employeeId}/invite`, { email });
  if (inv.status !== 200) throw new Error('invite falló: ' + JSON.stringify(inv.body));
  const token = new URL(inv.body.link).searchParams.get('token')!;
  const e = newClient(ctx);
  const r = await e.post('/employee/accept-invite', { token, password });
  if (r.status !== 200) throw new Error('accept falló: ' + JSON.stringify(r.body));
  return e;
}

export async function seedPlatformAdmin(ctx: TestCtx, email = 'admin@prueba.test', password = 'AdminClave1234') {
  await ctx.prisma.platformAdmin.create({ data: { email, passwordHash: await hashPassword(password) } });
  const c = newClient(ctx);
  const r = await c.post('/platform/login', { email, password });
  if (r.status !== 200) throw new Error('login admin falló: ' + JSON.stringify(r.body));
  return c;
}

export const resetLimiter = (ctx: TestCtx) => ctx.app.get(FailLimiter).reset();
