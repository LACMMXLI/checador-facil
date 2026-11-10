import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto';
import { addDays } from '../src/billing/subscription';
import { computeMetrics, localDateString, localToUtc, resolveShift, ScheduleDay } from '../src/attendance/engine';

import { DEFAULT_PLANS } from './plans';

const prisma = new PrismaClient();

async function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    // upsert sin pisar precios editados por el administrador: sólo crea si no existe.
    await prisma.plan.upsert({ where: { code: p.code }, update: {}, create: p });
  }
}

async function seedAdmin() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) { console.log('PLATFORM_ADMIN_EMAIL/PASSWORD no definidos: no se crea administrador SaaS.'); return; }
  const exists = await prisma.platformAdmin.findUnique({ where: { email } });
  if (exists) { console.log(`Administrador SaaS ya existe: ${email}`); return; }
  await prisma.platformAdmin.create({ data: { email, passwordHash: await hashPassword(password) } });
  console.log(`Administrador SaaS creado: ${email}`);
}

/** Negocio de demostración con datos 100% ficticios, marcado isDemo y aislado de clientes reales. */
async function seedDemo() {
  const email = 'demo@demo.checafacil.local';
  if (await prisma.user.findUnique({ where: { email } })) { console.log('Demo ya existe.'); return; }
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'negocio' } });
  const tenant = await prisma.tenant.create({ data: { name: 'Cafetería Demo (ficticia)', isDemo: true } });
  const user = await prisma.user.create({
    data: { email, name: 'Dueño Demo', passwordHash: await hashPassword('Demo#2027demo'), emailVerifiedAt: new Date() },
  });
  await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' } });
  await prisma.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: addDays(new Date(), 3650), graceDays: 3 } });
  const branch = await prisma.branch.create({ data: { tenantId: tenant.id, name: 'Sucursal Centro', timezone: 'America/Mexico_City' } });
  const tz = branch.timezone;
  const names = ['Ana López', 'Bruno Martínez', 'Carla Ruiz', 'Diego Herrera', 'Elena Torres'];
  const sched: ScheduleDay[] = [1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isRest: false, startMinutes: d % 2 ? 9 * 60 : 16 * 60, endMinutes: d % 2 ? 17 * 60 : 60 }));
  sched.push({ dayOfWeek: 0, isRest: true, startMinutes: 0, endMinutes: 0 });
  const { pinLookup } = await import('../src/common/crypto');
  for (let i = 0; i < names.length; i++) {
    const pin = String(100001 + i * 111); // PIN ficticios de demostración: 100001, 100112, …
    const emp = await prisma.employee.create({
      data: { tenantId: tenant.id, branchId: branch.id, name: names[i], employeeNumber: String(i + 1).padStart(3, '0'), pinLookup: pinLookup(tenant.id, pin) },
    });
    await prisma.workSchedule.createMany({ data: sched.map((s) => ({ ...s, tenantId: tenant.id, employeeId: emp.id })) });
    // Historial de los últimos 10 días
    for (let back = 10; back >= 1; back--) {
      const day = new Date(Date.now() - back * 86_400_000);
      const ld = localDateString(day, tz);
      const dow = new Date(`${ld}T12:00:00Z`).getUTCDay();
      const s = sched.find((x) => x.dayOfWeek === dow)!;
      if (s.isRest) continue;
      const [y, m, d] = ld.split('-').map(Number);
      const late = (i * 7 + back * 3) % 5 === 0 ? 14 + (back % 9) : (back + i) % 4;
      const startAt = localToUtc(y, m, d, s.startMinutes + late, tz);
      const endAt = localToUtc(y, m, d, s.endMinutes + (s.endMinutes <= s.startMinutes ? 1440 : 0) + ((back + i) % 3), tz);
      const shift = resolveShift(sched, startAt, tz);
      const met = computeMetrics(startAt, endAt, shift, branch.lateToleranceMinutes, branch.earlyLeaveToleranceMin);
      await prisma.punchEvent.createMany({
        data: [
          { tenantId: tenant.id, employeeId: emp.id, branchId: branch.id, source: 'PIN', type: 'IN', occurredAt: startAt, idempotencyKey: `seed:${emp.id}:${back}:in` },
          { tenantId: tenant.id, employeeId: emp.id, branchId: branch.id, source: 'PIN', type: 'OUT', occurredAt: endAt, idempotencyKey: `seed:${emp.id}:${back}:out` },
        ],
      });
      await prisma.workSession.create({
        data: {
          tenantId: tenant.id, employeeId: emp.id, branchId: branch.id, startAt, endAt, status: 'CLOSED', localDate: localDateString(startAt, tz),
          scheduledStart: shift?.start, scheduledEnd: shift?.end, lateMinutes: met.lateMinutes, earlyLeaveMinutes: met.earlyLeaveMinutes, workedMinutes: met.workedMinutes,
        },
      });
    }
  }
  console.log('Demo creado → correo: demo@demo.checafacil.local | contraseña: Demo#2027demo | PINs: 100001, 100112, 100223, 100334, 100445');
}

async function main() {
  await seedPlans();
  await seedAdmin();
  if (process.env.SEED_DEMO === 'true' || process.argv.includes('--demo')) await seedDemo();
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
