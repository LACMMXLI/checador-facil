'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { AuthShell } from '@/components/auth/shell';
import { ErrorBox, Spinner } from '@/components/ui';

function Verify() {
  const sp = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const token = sp.get('token');
    if (!token) { setState('err'); setMsg('El enlace no es válido.'); return; }
    api('/auth/verify-email', { body: { token } })
      .then(() => { setState('ok'); setTimeout(() => router.push('/panel?bienvenida=1'), 1500); })
      .catch((e) => { setState('err'); setMsg(errMsg(e)); });
  }, [sp, router]);
  return (
    <AuthShell title="Confirmando tu correo">
      {state === 'loading' && <div className="flex justify-center"><Spinner className="h-8 w-8" /></div>}
      {state === 'ok' && <div className="rounded-2xl bg-mint-50 p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-mint-500" /><p className="mt-3 font-semibold">¡Listo! Tu prueba gratis está activa. Te llevamos a tu panel…</p></div>}
      {state === 'err' && <ErrorBox message={msg} />}
    </AuthShell>
  );
}
export default function Page() { return <Suspense><Verify /></Suspense>; }
