'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { AuthLink, AuthShell } from '@/components/auth/shell';
import { Button, ErrorBox, Field, Input, Select } from '@/components/ui';
import { money } from '@/lib/format';
import type { PublicPlan } from '@/lib/public';

const schema = z.object({
  planCode: z.string().min(1, 'Elige un plan.'),
  businessName: z.string().trim().min(2, 'Escribe el nombre de tu negocio.').max(120),
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
  password: z.string().min(8, 'Mínimo 8 caracteres.').regex(/[a-zA-Z]/, 'Incluye al menos una letra.').regex(/\d/, 'Incluye al menos un número.'),
  acceptTerms: z.boolean().refine((v) => v, 'Debes aceptar los términos y el aviso de privacidad.'),
});
type Values = z.infer<typeof schema>;

export function RegisterForm({ plans }: { plans: PublicPlan[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = plans.find((p) => p.code === sp.get('plan'))?.code ?? plans[0]?.code ?? '';
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { planCode: initial, acceptTerms: false },
  });

  async function onSubmit(v: Values) {
    setError('');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await api<{ requiresVerification: boolean }>('/auth/register', { body: { ...v, timezone: tz } });
      if (r.requiresVerification) setSentTo(v.email); else router.push('/panel?bienvenida=1');
    } catch (e) { setError(errMsg(e)); }
  }

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo">
        <div className="rounded-2xl bg-brand-50 p-6 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-brand-600" />
          <p className="mt-4 text-lg font-semibold">Te enviamos un enlace a</p>
          <p className="font-bold text-brand-700">{sentTo}</p>
          <p className="mt-3 text-sm text-ink-600">Ábrelo para confirmar tu correo y activar tu prueba gratis. Si no lo ves, revisa tu carpeta de spam.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle={`Empieza tu prueba gratis de ${plans[0]?.trialDays ?? 7} días. No pedimos tarjeta.`} footer={<>¿Ya tienes cuenta? <AuthLink href="/login">Inicia sesión</AuthLink></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <ErrorBox message={error} />}
        {plans.length > 0 && (
          <Field label="Plan" error={errors.planCode?.message}>
            <Select {...register('planCode')}>{plans.map((p) => <option key={p.code} value={p.code}>{p.name} — {money(p.priceMonthlyCents, p.currency)}/mes</option>)}</Select>
          </Field>
        )}
        <Field label="Nombre de tu negocio" error={errors.businessName?.message}><Input {...register('businessName')} placeholder="Ej. Taquería El Güero" autoComplete="organization" /></Field>
        <Field label="Tu nombre" error={errors.name?.message}><Input {...register('name')} autoComplete="name" /></Field>
        <Field label="Correo electrónico" error={errors.email?.message}><Input type="email" inputMode="email" {...register('email')} autoComplete="email" /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres, con letras y números." error={errors.password?.message}><Input type="password" {...register('password')} autoComplete="new-password" /></Field>
        <div>
          <label className="flex items-start gap-3 text-sm text-ink-700">
            <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 h-5 w-5 rounded border-ink-300 text-brand-600" />
            <span>Acepto los <a className="font-semibold text-brand-700 underline" href="/terminos" target="_blank">términos de servicio</a> y el <a className="font-semibold text-brand-700 underline" href="/privacidad" target="_blank">aviso de privacidad</a>.</span>
          </label>
          {errors.acceptTerms && <p className="mt-1 text-sm text-red-600" role="alert">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Crear cuenta y comenzar</Button>
      </form>
    </AuthShell>
  );
}
