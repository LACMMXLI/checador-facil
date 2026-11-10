'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errMsg } from '@/lib/api';
import { AuthLink, AuthShell } from '@/components/auth/shell';
import { Button, ErrorBox, Field, Input, useToast } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setUnverified(false); setBusy(true);
    try {
      await api('/auth/login', { body: { email, password } });
      router.push('/panel');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setUnverified(true);
      setError(errMsg(err)); setBusy(false);
    }
  }
  async function resend() {
    try { await api('/auth/resend-verification', { body: { email } }); toast('Te enviamos un nuevo enlace.'); } catch (e) { toast(errMsg(e), 'err'); }
  }

  return (
    <AuthShell title="Inicia sesión" subtitle="Entra al panel de tu negocio." footer={<>¿Aún no tienes cuenta? <AuthLink href="/registro">Pruébalo gratis</AuthLink><br /><span className="mt-2 inline-block">¿Eres empleado? <AuthLink href="/empleado/login">Entra aquí</AuthLink></span></>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        {unverified && <button type="button" onClick={resend} className="text-sm font-semibold text-brand-700 underline">Reenviar enlace de confirmación</button>}
        <Field label="Correo electrónico"><Input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Entrar</Button>
        <p className="text-center text-sm"><AuthLink href="/recuperar">¿Olvidaste tu contraseña?</AuthLink></p>
      </form>
    </AuthShell>
  );
}
