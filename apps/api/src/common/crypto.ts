import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { config } from './config';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Índice determinista del PIN (HMAC con secreto del servidor): permite identificar sin guardar el PIN. */
export function pinLookup(tenantId: string, pin: string): string {
  return createHmac('sha256', config.secret).update(`pin:${tenantId}:${pin}`).digest('hex');
}
export const randomPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const randomCode = (len = 8) => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[randomInt(0, alphabet.length)];
  return s;
};

// Argon2id con los parámetros mínimos recomendados por OWASP.
const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (pw: string) => argon2.hash(pw, ARGON);
export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try { return await argon2.verify(hash, pw); } catch { return false; }
}
// Verificación ficticia para igualar tiempos cuando el usuario no existe.
let dummy: string | null = null;
export async function dummyVerify(pw: string) {
  if (!dummy) dummy = await hashPassword('dummy-password-not-used');
  await verifyPassword(dummy, pw);
}
