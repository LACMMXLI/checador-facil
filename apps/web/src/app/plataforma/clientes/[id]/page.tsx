'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, CalendarPlus, Pause, Play, RefreshCw, Ban, Sparkles, Receipt } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageLoading, Select, useToast } from '@/components/ui';
import { SUB_STATUS, dateEs, dateTimeEs, money } from '@/lib/format';

interface D {
  id: string; name: string; createdAt: string; owners: { name: string; email: string; emailVerifiedAt: string | null }[]; branches: { id: string; name: string; active: boolean }[];
  activeEmployees: number; activeDevices: number;
  subscription: { storedStatus: string; status: string; trialEndsAt: string | null; currentPeriodEnd: string | null; graceDays: number; plan: { id: string; name: string; priceMonthlyCents: number; currency: string; maxEmployees: number; maxBranches: number } };
  payments: { id: string; amountCents: number; currency: string; months: number; method: string; reference: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reportedAt: string }[];
  audit: { id: string; action: string; data: any; createdAt: string; actorType: string }[];
}
interface Plan { id: string; name: string; active: boolean }
const ACTIONS: Record<string, string> = { 'subscription.renew': 'Renovación', 'subscription.grant_days': 'Días de cortesía', 'subscription.set_suspended': 'Suspensión', 'subscription.set_active': 'Activación manual', 'subscription.set_canceled': 'Cancelación', 'subscription.start_trial': 'Prueba gratis', 'subscription.change_plan': 'Cambio de plan', 'subscription.set_past_due': 'Pago pendiente' };

export default function Client() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, error, mutate } = useSWR<D>(`/platform/tenants/${id}`, fetcher);
  const { data: plans } = useSWR<Plan[]>('/platform/plans', fetcher);
  const [modal, setModal] = useState<'renew' | 'days' | 'trial' | 'payment' | null>(null);
  const [n, setN] = useState('1'); const [amount, setAmount] = useState(''); const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  if (error) return <ErrorBox message="No encontramos este negocio." />;
  if (!data || !plans) return <PageLoading />;
  const s = data.subscription; const st = SUB_STATUS[s.status];
  const end = s.storedStatus === 'TRIAL' ? s.trialEndsAt : s.currentPeriodEnd;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setErr('');
    try { await fn(); toast(ok); setModal(null); mutate(); } catch (e) { setErr(errMsg(e)); toast(errMsg(e), 'err'); }
    setBusy(false);
  }
  const setStatus = (status: string, label: string) => { if (confirm(`¿${label} a "${data.name}"?`)) run(() => api(`/platform/tenants/${id}/status`, { body: { status } }), 'Listo.'); };

  return (
    <div className="space-y-6">
      <Link href="/plataforma/clientes" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />Clientes</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-extrabold sm:text-3xl">{data.name}</h1><Badge tone={st.tone} className="text-sm">{st.label}</Badge></div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Suscripción</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-ink-500">Plan</dt><dd className="font-semibold">{s.plan.name} · {money(s.plan.priceMonthlyCents, s.plan.currency)}</dd></div>
            <div><dt className="text-sm text-ink-500">{s.storedStatus === 'TRIAL' ? 'Prueba hasta' : 'Vigente hasta'}</dt><dd className="font-semibold">{dateEs(end)}</dd></div>
            <div><dt className="text-sm text-ink-500">Días de gracia</dt><dd className="font-semibold">{s.graceDays}</dd></div>
            <div><dt className="text-sm text-ink-500">Empleados activos</dt><dd className="font-semibold">{data.activeEmployees} / {s.plan.maxEmployees}</dd></div>
            <div><dt className="text-sm text-ink-500">Sucursales</dt><dd className="font-semibold">{data.branches.filter((b) => b.active).length} / {s.plan.maxBranches}</dd></div>
            <div><dt className="text-sm text-ink-500">Checadores activos</dt><dd className="font-semibold">{data.activeDevices}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => { setN('1'); setErr(''); setModal('renew'); }}><RefreshCw className="h-4 w-4" />Renovar</Button>
            <Button variant="outline" onClick={() => { setN('7'); setErr(''); setModal('days'); }}><CalendarPlus className="h-4 w-4" />Días de cortesía</Button>
            <Button variant="outline" onClick={() => { setN('14'); setErr(''); setModal('trial'); }}><Sparkles className="h-4 w-4" />Activar prueba</Button>
            <Button variant="outline" onClick={() => { setAmount(String(s.plan.priceMonthlyCents / 100)); setN('1'); setRef(''); setErr(''); setModal('payment'); }}><Receipt className="h-4 w-4" />Registrar pago</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            {s.storedStatus === 'SUSPENDED' || s.storedStatus === 'CANCELED'
              ? <Button size="sm" variant="soft" onClick={() => setStatus('ACTIVE', 'Reactivar')}><Play className="h-4 w-4" />Reactivar cuenta</Button>
              : <Button size="sm" variant="outline" onClick={() => setStatus('SUSPENDED', 'Suspender')}><Pause className="h-4 w-4" />Suspender</Button>}
            {s.storedStatus !== 'CANCELED' && <Button size="sm" variant="outline" onClick={() => setStatus('CANCELED', 'Cancelar la suscripción de')}><Ban className="h-4 w-4" />Cancelar</Button>}
            <Select className="h-9 w-auto text-sm" value={s.plan.id} onChange={(e) => run(() => api(`/platform/tenants/${id}/plan`, { method: 'PATCH', body: { planId: e.target.value } }), 'Plan actualizado.')} aria-label="Cambiar plan">
              {plans.filter((p) => p.active || p.id === s.plan.id).map((p) => <option key={p.id} value={p.id}>Plan: {p.name}</option>)}
            </Select>
          </div>
          <p className="mt-3 text-xs text-ink-500">Suspender o vencer no borra datos: el cliente puede consultar y exportar, pero no checar ni editar.</p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold">Propietario</h2>
          {data.owners.map((o) => <div key={o.email} className="mt-2"><p className="font-semibold">{o.name}</p><p className="text-sm text-ink-500">{o.email}</p><p className="text-xs text-ink-400">{o.emailVerifiedAt ? 'Correo verificado' : 'Correo sin verificar'}</p></div>)}
          <p className="mt-4 text-sm text-ink-500">Alta: {dateEs(data.createdAt)}</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Pagos</h2>
        {data.payments.length === 0 ? <p className="text-sm text-ink-500">Sin pagos registrados.</p> : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{money(p.amountCents, p.currency)} · {p.months} mes(es)</p><p className="text-sm text-ink-500">{p.method}{p.reference ? ` · ${p.reference}` : ''} · {dateTimeEs(p.reportedAt)}</p></div>
                <Badge tone={p.status === 'APPROVED' ? 'green' : p.status === 'PENDING' ? 'amber' : 'red'}>{p.status === 'APPROVED' ? 'Aprobado' : p.status === 'PENDING' ? 'Por revisar' : 'Rechazado'}</Badge></li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Bitácora de la suscripción</h2>
        <ul className="space-y-2">
          {data.audit.length === 0 && <li className="text-sm text-ink-500">Sin movimientos.</li>}
          {data.audit.map((a) => (
            <li key={a.id} className="rounded-xl bg-white p-3 text-sm shadow-soft ring-1 ring-ink-100">
              <p className="font-semibold">{ACTIONS[a.action] ?? a.action} <span className="font-normal text-ink-400">· {dateTimeEs(a.createdAt)} · {a.actorType === 'PLATFORM_ADMIN' ? 'Administrador' : 'Sistema'}</span></p>
              {a.data && <p className="text-ink-500">{Object.entries(a.data).map(([k, v]) => `${k}: ${String(v ?? '—').slice(0, 24)}`).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      </section>

      <Modal open={modal === 'renew'} onClose={() => setModal(null)} title="Renovar suscripción">
        <div className="space-y-4">{err && <ErrorBox message={err} />}
          <Field label="Meses a renovar" hint="Suma a la vigencia actual si aún no vence; si ya venció, cuenta desde hoy."><Input type="number" min={1} max={24} value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <p className="text-xs text-ink-500">Esto no registra un pago. Si recibiste dinero, usa “Registrar pago”.</p>
          <Button size="lg" className="w-full" loading={busy} onClick={() => run(() => api(`/platform/tenants/${id}/renew`, { body: { months: Number(n) } }), 'Suscripción renovada.')}>Renovar</Button></div>
      </Modal>
      <Modal open={modal === 'days'} onClose={() => setModal(null)} title="Días de cortesía">
        <div className="space-y-4">{err && <ErrorBox message={err} />}
          <Field label="Días a otorgar"><Input type="number" min={1} max={365} value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Button size="lg" className="w-full" loading={busy} onClick={() => run(() => api(`/platform/tenants/${id}/grant-days`, { body: { days: Number(n) } }), 'Días otorgados.')}>Otorgar</Button></div>
      </Modal>
      <Modal open={modal === 'trial'} onClose={() => setModal(null)} title="Activar prueba gratuita">
        <div className="space-y-4">{err && <ErrorBox message={err} />}
          <Field label="Días de prueba desde hoy"><Input type="number" min={1} max={120} value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Button size="lg" className="w-full" loading={busy} onClick={() => run(() => api(`/platform/tenants/${id}/trial`, { body: { days: Number(n) } }), 'Prueba activada.')}>Activar</Button></div>
      </Modal>
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Registrar pago recibido">
        <div className="space-y-4">{err && <ErrorBox message={err} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monto recibido (MXN)"><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Meses que cubre"><Input type="number" min={1} max={24} value={n} onChange={(e) => setN(e.target.value)} /></Field>
          </div>
          <Field label="Referencia"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Folio, efectivo, SPEI…" /></Field>
          <p className="text-xs text-ink-500">Se registra como aprobado y renueva la suscripción automáticamente.</p>
          <Button size="lg" className="w-full" loading={busy} onClick={() => run(() => api(`/platform/tenants/${id}/payments`, { body: { amountCents: Math.round(Number(amount) * 100), months: Number(n), reference: ref || undefined } }), 'Pago registrado y servicio renovado.')}>Registrar y renovar</Button></div>
      </Modal>
    </div>
  );
}
