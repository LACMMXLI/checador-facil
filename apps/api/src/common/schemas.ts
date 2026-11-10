import { z } from 'zod';

export const emailS = z.string({ required_error: 'Escribe tu correo.' }).trim().toLowerCase().email('Escribe un correo válido.').max(160);
export const passwordS = z.string({ required_error: 'Escribe una contraseña.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'La contraseña debe incluir letras y números.');
export const nameS = z.string({ required_error: 'Escribe un nombre.' }).trim().min(2, 'El nombre es muy corto.').max(120);
export const uuidS = z.string().uuid('Dato no válido.');
export const localDateS = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (AAAA-MM-DD).');
export const timeMinutesS = z.number().int().min(0).max(1439);
export const pinS = z.string().regex(/^\d{6}$/, 'El PIN debe tener 6 dígitos.');
export const idemS = z.string().min(8).max(100).optional();

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
