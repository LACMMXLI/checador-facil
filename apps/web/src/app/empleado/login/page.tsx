'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/lib/api';
import { Button, ErrorBox, Field, Input, Logo } from '@/components/ui';

export default function EmployeeLogin() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/employee/login', { body: { email, password } }); router.push('/empleado'); } catch (err) { setError(errMsg(err)); setBusy(false); }
  }
  return (
    <div className="pt-6">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <h1 className="text-center font-display text-3xl font-extrabold">Portal del empleado</h1>
      <p className="mt-2 text-center text-ink-600">Entra para registrar tu asistencia.</p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-white p-6 shadow-soft">
        {error && <ErrorBox message={error} />}
        <Field label="Correo"><Input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></Field>
        <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Entrar</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">¿No tienes acceso? Pídele a tu encargado que te envíe una invitación.</p>
    </div>
  );
}
