'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { QrCode } from '@/components/qr-code';
import { Button, ErrorBox, Field, Input, Logo } from '@/components/ui';

type Step = 'creds' | 'code' | 'setup';

export default function PlatformLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('creds');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(errMsg(e)); } setBusy(false); }

  const login = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const r = await api<{ mfaRequired: boolean; mfaSetupRequired: boolean }>('/platform/login', { body: { email, password } });
    if (!r.mfaRequired) return router.push('/plataforma');
    if (r.mfaSetupRequired) { setSetup(await api('/platform/mfa/setup', { body: {} })); setStep('setup'); } else setStep('code');
  }); };
  const verify = (e: React.FormEvent) => { e.preventDefault(); run(async () => { await api('/platform/mfa/verify', { body: { code } }); router.push('/plataforma'); }); };
  const enable = (e: React.FormEvent) => { e.preventDefault(); run(async () => { await api('/platform/mfa/enable', { body: { code } }); router.push('/plataforma'); }); };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <p className="mb-1 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-700"><ShieldCheck className="h-4 w-4" />Administración de la plataforma</p>
        {error && <div className="my-4"><ErrorBox message={error} /></div>}
        {step === 'creds' && (
          <form onSubmit={login} className="mt-5 space-y-4">
            <Field label="Correo"><Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Contraseña"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>Continuar</Button>
          </form>
        )}
        {step === 'code' && (
          <form onSubmit={verify} className="mt-5 space-y-4">
            <Field label="Código de verificación en dos pasos" hint="Abre tu app de autenticación y escribe el código de 6 dígitos."><Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-2xl tracking-[.4em]" /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Entrar</Button>
          </form>
        )}
        {step === 'setup' && setup && (
          <form onSubmit={enable} className="mt-5 space-y-4">
            <p className="text-sm text-ink-600">Este acceso exige verificación en dos pasos. Escanea el código con tu app de autenticación (Google Authenticator, Authy, 1Password…) y escribe el código que te muestre.</p>
            <div className="flex justify-center"><div className="rounded-2xl border border-ink-100 p-3"><QrCode value={setup.otpauthUri} size={220} /></div></div>
            <p className="break-all rounded-xl bg-ink-50 p-3 text-center font-mono text-xs">{setup.secret}</p>
            <Field label="Código de 6 dígitos"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-2xl tracking-[.4em]" /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Activar y entrar</Button>
          </form>
        )}
      </div>
    </div>
  );
}
