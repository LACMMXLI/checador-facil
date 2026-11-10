'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { CreditCard, MonitorSmartphone, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageLoading, Select, cn, useToast } from '@/components/ui';
import { TIMEZONES, dateTimeEs } from '@/lib/format';
import type { Me } from '../layout';

interface Branch {
  id: string; name: string; timezone: string; punchMode: 'QR_ONLY' | 'PIN_ONLY' | 'QR_AND_PIN'; qrConfirmMode: 'AUTO' | 'CONFIRM';
  lateToleranceMinutes: number; earlyLeaveToleranceMin: number; minPunchGapSeconds: number; maxOpenHours: number; active: boolean;
}
interface Device { id: string; name: string; status: 'ACTIVE' | 'REVOKED'; branch: { id: string; name: string }; lastSeenAt: string | null; createdAt: string }

const MODES = { QR_ONLY: 'Sólo QR', PIN_ONLY: 'Sólo PIN', QR_AND_PIN: 'QR y PIN' } as const;

export default function Settings() {
  const toast = useToast();
  const { data: me, mutate: mutateMe } = useSWR<Me>('/auth/me', fetcher);
  const { data: branches, error, mutate: mutateB } = useSWR<Branch[]>('/app/branches', fetcher);
  const { data: devices, mutate: mutateD } = useSWR<Device[]>('/app/devices', fetcher, { refreshInterval: 30_000 });
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Branch> | null>(null);
  const [linking, setLinking] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const writable = me?.subscription.operational ?? true;

  if (error) return <ErrorBox message="No pudimos cargar tu configuración." onRetry={() => mutateB()} />;
  if (!branches || !devices || !me) return <PageLoading />;

  const saveName = async () => {
    try { await api('/app/tenant', { method: 'PATCH', body: { name } }); toast('Nombre actualizado.'); setName(null); mutateMe(); } catch (e) { toast(errMsg(e), 'err'); }
  };
  const revoke = async (d: Device) => {
    if (!confirm(`¿Revocar "${d.name}"? Dejará de funcionar como checador de inmediato.`)) return;
    try { await api(`/app/devices/${d.id}/revoke`, { body: {} }); toast('Dispositivo revocado.'); mutateD(); } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Configuración</h1>

      <Card>
        <h2 className="font-display text-lg font-bold">Tu negocio</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={name ?? me.tenant.name} onChange={(e) => setName(e.target.value)} disabled={!writable} aria-label="Nombre del negocio" />
          <Button onClick={saveName} disabled={name === null || !writable}>Guardar</Button>
        </div>
        <Link href="/panel/suscripcion" className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><CreditCard className="h-4 w-4" />Ver mi suscripción y plan</Link>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Store className="h-5 w-5" />Sucursales</h2>
          <Button size="sm" variant="outline" disabled={!writable} onClick={() => setEditing({ name: '', timezone: branches[0]?.timezone ?? 'America/Mexico_City', punchMode: 'QR_AND_PIN', qrConfirmMode: 'AUTO', lateToleranceMinutes: 10, earlyLeaveToleranceMin: 0, minPunchGapSeconds: 60, maxOpenHours: 16 })}><Plus className="h-4 w-4" />Agregar sucursal</Button>
        </div>
        {branches.map((b) => (
          <Card key={b.id} className={cn('p-4', !b.active && 'opacity-60')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-bold">{b.name} {!b.active && <Badge>Inactiva</Badge>}</p>
                <p className="mt-1 text-sm text-ink-500">{MODES[b.punchMode]} · {b.qrConfirmMode === 'AUTO' ? 'QR automático' : 'QR con confirmación'} · tolerancia {b.lateToleranceMinutes} min</p>
              </div>
              <Button size="sm" variant="soft" onClick={() => setEditing(b)} disabled={!writable}><Pencil className="h-4 w-4" />Editar</Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MonitorSmartphone className="h-5 w-5" />Dispositivos checadores</h2>
          <Button size="sm" onClick={() => setLinking(true)} disabled={!writable}><Plus className="h-4 w-4" />Vincular tableta</Button>
        </div>
        <p className="text-sm text-ink-500">Una tableta, celular o computadora puede funcionar como checador. Se vincula con un código temporal y no tiene acceso a información administrativa.</p>
        {devices.length === 0 ? <Empty title="Aún no has vinculado ningún checador" /> : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{d.name} <span className="font-normal text-ink-400">· {d.branch.name}</span></p>
                  <p className="text-sm text-ink-500">{d.status === 'ACTIVE' ? `Visto: ${d.lastSeenAt ? dateTimeEs(d.lastSeenAt) : 'nunca'}` : 'Revocado'}</p>
                </div>
                {d.status === 'ACTIVE' ? <Button size="sm" variant="outline" onClick={() => revoke(d)}><Trash2 className="h-4 w-4" />Revocar</Button> : <Badge tone="red">Revocado</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <BranchModal initial={editing} branches={branches} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); mutateB(); }} />}
      {linking && <LinkModal branches={branches.filter((b) => b.active)} onClose={() => setLinking(false)} onCreated={(c) => { setLinking(false); setCode(c); }} />}
      <Modal open={!!code} onClose={() => { setCode(null); mutateD(); }} title="Código de vinculación">
        {code && (
          <div className="text-center">
            <p className="text-ink-600">En la tableta abre esta dirección y escribe el código:</p>
            <p className="mt-2 break-all rounded-xl bg-ink-50 p-3 font-mono text-sm font-semibold">{typeof window !== 'undefined' ? `${window.location.origin}/kiosko` : '/kiosko'}</p>
            <p className="my-5 font-display text-5xl font-extrabold tracking-[.2em] text-brand-700">{code.code}</p>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Vence a las {new Date(code.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} y sólo sirve una vez.</p>
            <Button className="mt-4 w-full" onClick={() => { setCode(null); mutateD(); }}>Listo</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LinkModal({ branches, onClose, onCreated }: { branches: Branch[]; onClose: () => void; onCreated: (c: { code: string; expiresAt: string }) => void }) {
  const [name, setName] = useState('Tableta de la entrada'); const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try { onCreated(await api('/app/devices/activation', { body: { name, branchId } })); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Vincular un checador">
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Field label="Nombre del dispositivo"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {branches.length > 1 && <Field label="Sucursal"><Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
        <Button size="lg" className="w-full" onClick={go} loading={busy} disabled={name.trim().length < 2}>Generar código</Button>
      </div>
    </Modal>
  );
}

function BranchModal({ initial, branches, onClose, onSaved }: { initial: Partial<Branch>; branches: Branch[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = !initial.id;
  const [f, setF] = useState({ ...initial });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const tzList = TIMEZONES.some(([z]) => z === f.timezone) ? TIMEZONES : [...TIMEZONES, [f.timezone!, f.timezone!] as const];
  const set = <K extends keyof Branch>(k: K, v: Branch[K]) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true); setErr('');
    try {
      const body = { name: f.name, timezone: f.timezone, punchMode: f.punchMode, qrConfirmMode: f.qrConfirmMode, lateToleranceMinutes: Number(f.lateToleranceMinutes), earlyLeaveToleranceMin: Number(f.earlyLeaveToleranceMin), minPunchGapSeconds: Number(f.minPunchGapSeconds), maxOpenHours: Number(f.maxOpenHours) };
      if (isNew) await api('/app/branches', { body }); else await api(`/app/branches/${initial.id}`, { method: 'PATCH', body });
      toast('Sucursal guardada.'); onSaved();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setErr('');
    try { await api(`/app/branches/${initial.id}`, { method: 'PATCH', body: { active: !f.active } }); onSaved(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  const Choice = ({ label, active, onClick, desc }: { label: string; active: boolean; onClick: () => void; desc?: string }) => (
    <button type="button" onClick={onClick} className={cn('rounded-xl border p-3 text-left transition', active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-ink-200 hover:bg-ink-50')}>
      <p className="font-semibold">{label}</p>{desc && <p className="text-xs text-ink-500">{desc}</p>}
    </button>
  );
  return (
    <Modal open onClose={onClose} title={isNew ? 'Nueva sucursal' : 'Editar sucursal'} wide>
      <div className="space-y-5">
        {err && <ErrorBox message={err} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><Input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Zona horaria"><Select value={f.timezone} onChange={(e) => set('timezone', e.target.value)}>{tzList.map(([z, l]) => <option key={z} value={z}>{l}</option>)}</Select></Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">¿Cómo checan tus empleados?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => <Choice key={m} label={MODES[m]} active={f.punchMode === m} onClick={() => set('punchMode', m)} desc={m === 'QR_AND_PIN' ? 'Recomendado' : undefined} />)}
          </div>
        </div>
        {f.punchMode !== 'PIN_ONLY' && (
          <div>
            <p className="mb-2 text-sm font-semibold">Al escanear el QR…</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice label="Registrar de inmediato" active={f.qrConfirmMode === 'AUTO'} onClick={() => set('qrConfirmMode', 'AUTO')} desc="Más rápido: escanea y listo." />
              <Choice label="Pedir confirmación" active={f.qrConfirmMode === 'CONFIRM'} onClick={() => set('qrConfirmMode', 'CONFIRM')} desc="Muestra el movimiento y el empleado confirma." />
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tolerancia de entrada (min)" hint="Hasta cuántos minutos tarde no cuenta como retardo."><Input type="number" min={0} max={120} value={f.lateToleranceMinutes ?? 0} onChange={(e) => set('lateToleranceMinutes', Number(e.target.value))} /></Field>
          <Field label="Tolerancia de salida (min)" hint="Minutos antes de su hora que no cuentan como salida anticipada."><Input type="number" min={0} max={120} value={f.earlyLeaveToleranceMin ?? 0} onChange={(e) => set('earlyLeaveToleranceMin', Number(e.target.value))} /></Field>
          <Field label="Separación mínima entre checadas (seg)" hint="Evita checadas duplicadas por error."><Input type="number" min={10} max={3600} value={f.minPunchGapSeconds ?? 60} onChange={(e) => set('minPunchGapSeconds', Number(e.target.value))} /></Field>
          <Field label="Jornada olvidada tras (horas)" hint="Si no hay salida después de este tiempo, se marca incompleta."><Input type="number" min={4} max={48} value={f.maxOpenHours ?? 16} onChange={(e) => set('maxOpenHours', Number(e.target.value))} /></Field>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          {!isNew && branches.length > 1 ? <Button variant="outline" onClick={toggle} disabled={busy}>{f.active ? 'Desactivar sucursal' : 'Reactivar sucursal'}</Button> : <span />}
          <Button onClick={save} loading={busy} disabled={!f.name || f.name.trim().length < 2}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
