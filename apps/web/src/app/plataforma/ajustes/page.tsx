'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ShieldCheck } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, PageLoading, Textarea, useToast } from '@/components/ui';
import { QrCode } from '@/components/qr-code';

type S = Record<string, string>;

export default function Settings() {
  const toast = useToast();
  const { data, error, mutate } = useSWR<S>('/platform/settings', fetcher);
  const { data: me, mutate: mutateMe } = useSWR<{ email: string; mfaEnabled: boolean }>('/platform/me', fetcher);
  const [f, setF] = useState<S>({});
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => { if (data) setF(data); }, [data]);
  if (error) return <ErrorBox message="No pudimos cargar los ajustes." onRetry={() => mutate()} />;
  if (!data || !me) return <PageLoading />;

  async function save() {
    setBusy(true);
    try { await api('/platform/settings', { method: 'PUT', body: f }); toast('Ajustes guardados.'); mutate(); } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  }
  async function startMfa() { try { setMfa(await api('/platform/mfa/setup', { body: {} })); } catch (e) { toast(errMsg(e), 'err'); } }
  async function enableMfa() { try { await api('/platform/mfa/enable', { body: { code } }); toast('Verificación en dos pasos activada.'); setMfa(null); setCode(''); mutateMe(); } catch (e) { toast(errMsg(e), 'err'); } }

  const field = (k: string, label: string, hint?: string, area?: boolean) => (
    <Field label={label} hint={hint}>{area ? <Textarea rows={4} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Field>
  );
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Ajustes de la plataforma</h1>
      <Card className="space-y-4">
        {field('brand_name', 'Nombre de la marca')}
        {field('contact_email', 'Correo de contacto', 'Se muestra en el sitio y en la pantalla de suscripción.')}
        {field('contact_whatsapp', 'WhatsApp de contacto (con lada)', 'Opcional.')}
        {field('payment_instructions', 'Instrucciones de pago', 'Banco, CLABE, titular… Se muestran a los clientes en “Mi suscripción”.', true)}
        {field('default_grace_days', 'Días de gracia para negocios nuevos', 'Se aplica a las suscripciones que se creen desde ahora.')}
        <Button onClick={save} loading={busy}>Guardar ajustes</Button>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="h-5 w-5" />Verificación en dos pasos (MFA)</h2>
        <p className="mt-2 text-sm text-ink-600">Estado: {me.mfaEnabled ? <Badge tone="green">Activada</Badge> : <Badge tone="red">No activada</Badge>}</p>
        {!me.mfaEnabled && !mfa && <Button className="mt-3" onClick={startMfa}>Activar ahora</Button>}
        {mfa && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-center"><div className="rounded-2xl border border-ink-100 p-3"><QrCode value={mfa.otpauthUri} size={200} /></div></div>
            <p className="break-all rounded-xl bg-ink-50 p-2 text-center font-mono text-xs">{mfa.secret}</p>
            <Field label="Código de 6 dígitos"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
            <Button onClick={enableMfa} disabled={code.length !== 6}>Confirmar y activar</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
