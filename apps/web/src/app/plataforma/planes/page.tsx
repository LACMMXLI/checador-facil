'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Pencil, Plus } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageLoading, Textarea, useToast } from '@/components/ui';
import { money } from '@/lib/format';

interface Plan {
  id: string; code: string; name: string; description: string; priceMonthlyCents: number; currency: string; maxEmployees: number; maxBranches: number;
  trialDays: number; historyDays: number; canExport: boolean; canSchedules: boolean; canLateControl: boolean; features: string[]; highlighted: boolean; active: boolean; sortOrder: number;
}
const blank = { code: '', name: '', description: '', price: '149', maxEmployees: '15', maxBranches: '1', trialDays: '7', historyDays: '365', canExport: true, canSchedules: true, canLateControl: true, features: '', highlighted: false, active: true, sortOrder: '0' };

export default function Plans() {
  const toast = useToast();
  const { data, error, mutate } = useSWR<Plan[]>('/platform/plans', fetcher);
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message="No pudimos cargar los planes." onRetry={() => mutate()} />;
  if (!data) return <PageLoading />;

  const edit = (p: Plan) => { setErr(''); setEditing({ id: p.id, code: p.code, name: p.name, description: p.description, price: String(p.priceMonthlyCents / 100), maxEmployees: String(p.maxEmployees), maxBranches: String(p.maxBranches), trialDays: String(p.trialDays), historyDays: String(p.historyDays), canExport: p.canExport, canSchedules: p.canSchedules, canLateControl: p.canLateControl, features: p.features.join('\n'), highlighted: p.highlighted, active: p.active, sortOrder: String(p.sortOrder) }); };
  async function save() {
    if (!editing) return; setBusy(true); setErr('');
    const body = {
      ...(editing.id ? {} : { code: editing.code }), name: editing.name, description: editing.description, priceMonthlyCents: Math.round(Number(editing.price) * 100),
      maxEmployees: Number(editing.maxEmployees), maxBranches: Number(editing.maxBranches), trialDays: Number(editing.trialDays), historyDays: Number(editing.historyDays), canExport: editing.canExport, canSchedules: editing.canSchedules, canLateControl: editing.canLateControl,
      features: editing.features.split('\n').map((s) => s.trim()).filter(Boolean), highlighted: editing.highlighted, active: editing.active, sortOrder: Number(editing.sortOrder),
    };
    try {
      if (editing.id) await api(`/platform/plans/${editing.id}`, { method: 'PATCH', body }); else await api('/platform/plans', { body });
      toast('Plan guardado. Ya se refleja en la página pública.'); setEditing(null); mutate();
    } catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  }
  const set = (k: keyof typeof blank, v: string | boolean) => setEditing((x) => (x ? { ...x, [k]: v } : x));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-extrabold sm:text-3xl">Planes y precios</h1><Button onClick={() => { setErr(''); setEditing({ ...blank }); }}><Plus className="h-5 w-5" />Nuevo plan</Button></div>
      <p className="text-sm text-ink-500">Los cambios de precio se muestran de inmediato en la página pública y se usan en los pagos nuevos. Los límites se validan en el servidor.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((p) => (
          <Card key={p.id} className={p.active ? '' : 'opacity-60'}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-display text-xl font-extrabold">{p.name} {!p.active && <Badge>Inactivo</Badge>} {p.highlighted && <Badge tone="blue">Destacado</Badge>}</p><p className="text-sm text-ink-500">código: {p.code}</p></div>
              <Button size="sm" variant="soft" onClick={() => edit(p)}><Pencil className="h-4 w-4" />Editar</Button>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold">{money(p.priceMonthlyCents, p.currency)}<span className="text-base font-medium text-ink-500"> / mes</span></p>
            <p className="mt-2 text-sm text-ink-600">Hasta {p.maxEmployees} empleados · {p.maxBranches} sucursal(es) · {p.trialDays} días de prueba · historial {p.historyDays} días · {p.canExport ? 'con' : 'sin'} Excel · {p.canSchedules ? 'con' : 'sin'} horarios · {p.canLateControl ? 'con' : 'sin'} retardos</p>
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-ink-600">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </Card>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar plan' : 'Nuevo plan'} wide>
        {editing && (
          <div className="space-y-4">
            {err && <ErrorBox message={err} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre"><Input value={editing.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Código" hint="No se puede cambiar después."><Input value={editing.code} disabled={!!editing.id} onChange={(e) => set('code', e.target.value)} /></Field>
              <Field label="Precio mensual (MXN)"><Input type="number" min={0} step="0.01" value={editing.price} onChange={(e) => set('price', e.target.value)} /></Field>
              <Field label="Días de prueba"><Input type="number" min={0} value={editing.trialDays} onChange={(e) => set('trialDays', e.target.value)} /></Field>
              <Field label="Límite de empleados"><Input type="number" min={1} value={editing.maxEmployees} onChange={(e) => set('maxEmployees', e.target.value)} /></Field>
              <Field label="Límite de sucursales"><Input type="number" min={1} value={editing.maxBranches} onChange={(e) => set('maxBranches', e.target.value)} /></Field>
              <Field label="Historial de reportes (días)" hint="Cuántos días hacia atrás puede ver el cliente. Los datos no se borran."><Input type="number" min={1} value={editing.historyDays} onChange={(e) => set('historyDays', e.target.value)} /></Field>
              <label className="flex items-center gap-2 self-end pb-3 font-semibold"><input type="checkbox" className="h-5 w-5" checked={editing.canExport} onChange={(e) => set('canExport', e.target.checked)} />Permite exportar a Excel</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={editing.canSchedules} onChange={(e) => set('canSchedules', e.target.checked)} />Horarios y turnos nocturnos</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={editing.canLateControl} onChange={(e) => set('canLateControl', e.target.checked)} />Control de retardos</label>
            </div>
            <Field label="Descripción corta"><Input value={editing.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Características (una por línea)" hint="Sólo incluye funciones que ya existan."><Textarea rows={6} value={editing.features} onChange={(e) => set('features', e.target.value)} /></Field>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={editing.active} onChange={(e) => set('active', e.target.checked)} />Activo (visible)</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={editing.highlighted} onChange={(e) => set('highlighted', e.target.checked)} />Destacado</label>
              <label className="flex items-center gap-2 font-semibold">Orden<Input type="number" className="h-9 w-20" value={editing.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></label>
            </div>
            <Button size="lg" className="w-full" loading={busy} onClick={save}>Guardar plan</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
