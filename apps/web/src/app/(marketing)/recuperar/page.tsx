'use client';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { AuthLink, AuthShell } from '@/components/auth/shell';
import { Button, ErrorBox, Field, Input } from '@/components/ui';

export default function Page() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/forgot', { body: { email } }); setSent(true); } catch (err) { setError(errMsg(err)); }
    setBusy(false);
  }
  return (
    <AuthShell title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una nueva." footer={<AuthLink href="/login">Volver a iniciar sesión</AuthLink>}>
      {sent ? (
        <div className="rounded-2xl bg-brand-50 p-6 text-center"><MailCheck className="mx-auto h-10 w-10 text-brand-600" /><p className="mt-3 font-semibold">Si ese correo tiene una cuenta, te enviamos un enlace. Vence en 2 horas.</p></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Correo electrónico"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Enviar enlace</Button>
        </form>
      )}
    </AuthShell>
  );
}
