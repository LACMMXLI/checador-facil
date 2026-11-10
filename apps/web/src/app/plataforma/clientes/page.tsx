'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, Search } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageLoading, Select } from '@/components/ui';
import { SUB_STATUS, dateEs } from '@/lib/format';

interface T {
  id: string; name: string; isDemo: boolean; createdAt: string; owner: { name: string; email: string } | null; activeEmployees: number; branches: number;
  plan: { id: string; name: string } | null; status: string | null; periodEnd: string | null;
}
interface Plan { code: string; name: string; active: boolean }

export default function Clients() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data, error, mutate } = useSWR<T[]>(`/platform/tenants${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`, fetcher, { keepPreviousData: true });
  const { data: plans } = useSWR<Plan[]>('/platform/plans', fetcher);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ businessName: '', ownerName: '', ownerEmail: '', planCode: '', trialDays: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ ownerEmail: string; tempPassword: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await api<{ ownerEmail: string; tempPassword: string }>('/platform/tenants', { body: { ...f, planCode: f.planCode || plans?.find((p) => p.active)?.code, trialDays: f.trialDays ? Number(f.trialDays) : undefined } });
      setOpen(false); setCreated(r); setF({ businessName: '', ownerName: '', ownerEmail: '', planCode: '', trialDays: '' }); mutate();
    } catch (er) { setErr(errMsg(er)); }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Clientes</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-5 w-5" />Nuevo negocio</Button>
      </div>
      <div className="relative"><Search className="absolute left-3.5 top-3 h-5 w-5 text-ink-400" /><Input className="pl-11" placeholder="Buscar por negocio o correo…" value={q} onChange={(e) => { setQ(e.target.value); clearTimeout((window as any).__q); (window as any).__q = setTimeout(() => setDebounced(e.target.value.trim()), 350); }} /></div>

      {error ? <ErrorBox message="No pudimos cargar los clientes." onRetry={() => mutate()} /> : !data ? <PageLoading /> : data.length === 0 ? <Empty title="No hay negocios" /> : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-soft">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Negocio</th><th className="px-4 py-3">Propietario</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3">Empleados</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.map((t) => {
                const st = t.status ? SUB_STATUS[t.status] : null;
                return (
                  <tr key={t.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3"><Link href={`/plataforma/clientes/${t.id}`} className="font-semibold text-brand-700 hover:underline">{t.name}</Link>{t.isDemo && <Badge className="ml-2">Demo</Badge>}<p className="text-xs text-ink-400">Alta {dateEs(t.createdAt)}</p></td>
                    <td className="px-4 py-3"><p>{t.owner?.name}</p><p className="text-xs text-ink-500">{t.owner?.email}</p></td>
                    <td className="px-4 py-3">{t.plan?.name ?? '—'}</td>
                    <td className="px-4 py-3">{st ? <Badge tone={st.tone}>{st.label}</Badge> : '—'}</td>
                    <td className="px-4 py-3">{dateEs(t.periodEnd)}</td>
                    <td className="px-4 py-3 tabular-nums">{t.activeEmployees} · {t.branches} suc.</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo negocio">
        <form onSubmit={create} className="space-y-4">
          {err && <ErrorBox message={err} />}
          <Field label="Nombre del negocio"><Input required value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} /></Field>
          <Field label="Nombre del propietario"><Input required value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></Field>
          <Field label="Correo del propietario"><Input type="email" required value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan"><Select value={f.planCode} onChange={(e) => setF({ ...f, planCode: e.target.value })}>{plans?.filter((p) => p.active).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
            <Field label="Días de prueba" hint="Vacío = los del plan."><Input type="number" min={0} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: e.target.value })} /></Field>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Crear negocio</Button>
        </form>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title="Negocio creado">
        {created && <div className="space-y-3 text-sm"><p>Entrégale estas credenciales al propietario (la contraseña <strong>no se vuelve a mostrar</strong>; puede cambiarla con “Olvidé mi contraseña”):</p>
          <p className="rounded-xl bg-ink-50 p-3 font-mono">Correo: {created.ownerEmail}<br />Contraseña: {created.tempPassword}</p><Button className="w-full" onClick={() => setCreated(null)}>Listo</Button></div>}
      </Modal>
    </div>
  );
}
