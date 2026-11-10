/**
 * Crea (o restablece) el administrador SaaS directamente en la base de datos.
 * La contraseña se pide por la terminal con la entrada oculta: no viaja por variables de entorno ni queda en el historial.
 *
 * Uso (dentro del contenedor api, en la terminal de Coolify):
 *   npx ts-node prisma/create-admin.ts correo@ejemplo.com
 *   npx ts-node prisma/create-admin.ts correo@ejemplo.com --reset   # cambia la contraseña de un admin existente (y reinicia su MFA)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createInterface } from 'node:readline';
import { hashPassword } from '../src/common/crypto';

const prisma = new PrismaClient();

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const anyRl = rl as unknown as { _writeToOutput: (s: string) => void };
    let muted = false;
    // Muestra la pregunta, pero NO lo que se teclea después.
    anyRl._writeToOutput = (s: string) => { if (!muted) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const reset = process.argv.includes('--reset');
  if (!/^\S+@\S+\.\S+$/.test(email)) { console.error('Uso: npx ts-node prisma/create-admin.ts correo@ejemplo.com [--reset]'); process.exit(1); }

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing && !reset) { console.error(`Ya existe un administrador con ${email}. Usa --reset para cambiar su contraseña.`); process.exit(1); }

  const pw1 = await ask('Contraseña (mínimo 12 caracteres): ');
  const pw2 = await ask('Repite la contraseña: ');
  if (pw1 !== pw2) { console.error('Las contraseñas no coinciden.'); process.exit(1); }
  if (pw1.length < 12) { console.error('Usa al menos 12 caracteres.'); process.exit(1); }

  const passwordHash = await hashPassword(pw1);
  if (existing) {
    await prisma.platformAdmin.update({ where: { email }, data: { passwordHash, totpSecret: null, totpEnabled: false } });
    await prisma.authSession.updateMany({ where: { subjectType: 'PLATFORM_ADMIN', subjectId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`Contraseña restablecida para ${email}. Se cerraron sus sesiones y se reinició su MFA.`);
  } else {
    await prisma.platformAdmin.create({ data: { email, passwordHash } });
    console.log(`Administrador SaaS creado: ${email}`);
  }
  console.log('Entra a /plataforma/login y activa la verificación en dos pasos de inmediato.');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
