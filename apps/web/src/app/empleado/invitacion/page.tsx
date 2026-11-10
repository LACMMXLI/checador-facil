'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errMsg } from '@/lib/api';
import { Button, ErrorBox, Field, Input, Logo } from '@/components/ui';

function Invite() {
  const sp = useSearchParams(); const router = useRouter();
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/employee/accept-invite', { body: { token: sp.get('token'), password } }); router.push('/empleado'); } catch (err) { setError(errMsg(err)); setBusy(false); }
  }
  return (
    <div className="pt-6">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <h1 className="text-center font-display text-3xl font-extrabold">Crea tu contraseña</h1>
      <p className="mt-2 text-center text-ink-600">Con ella entrarás desde tu celular para registrar tu asistencia.</p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-white p-6 shadow-soft">
        {error && <ErrorBox message={error} />}
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números."><Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Guardar y entrar</Button>
      </form>
    </div>
  );
}
export default function Page() { return <Suspense><Invite /></Suspense>; }
