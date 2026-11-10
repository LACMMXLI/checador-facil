'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errMsg } from '@/lib/api';
import { AuthShell } from '@/components/auth/shell';
import { Button, ErrorBox, Field, Input, useToast } from '@/components/ui';

function Reset() {
  const sp = useSearchParams(); const router = useRouter(); const toast = useToast();
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/reset', { body: { token: sp.get('token'), password } }); toast('Contraseña actualizada. Inicia sesión.'); router.push('/login'); }
    catch (err) { setError(errMsg(err)); setBusy(false); }
  }
  return (
    <AuthShell title="Crea tu nueva contraseña">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números."><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Guardar contraseña</Button>
      </form>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><Reset /></Suspense>; }
