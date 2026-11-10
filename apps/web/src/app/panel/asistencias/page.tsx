'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Download, Lock, Plus, Sparkles } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageLoading, Select, Textarea, cn, useToast } from '@/components/ui';
import { hhmm } from '@/lib/format';
import { SessionsList, type SessionRow } from '@/components/panel/sessions';
import type { Me } from '../layout';

interface Res { range: { from: string; to: string }; limited: boolean; plan: { historyDays: number; canExport: boolean }; totals: { workedMinutes: number; late: number; incomplete: number }; rows: SessionRow[] }
interface Emp { id: string; name: string }
interface Branch { id: string; name: string }

const PRESETS = [['today', 'Hoy'], ['yesterday', 'Ayer'], ['week', 'Semana'], ['fortnight', 'Quincena'], ['month', 'Mes'], ['custom', 'Rango']] as const;

function Attendance() {
  const sp = useSearchParams();
  const toast = useToast();
  const [preset, setPreset] = useState<string>('today');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [employeeId, setEmployeeId] = useState(''); const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState(sp.get('status') ?? '');
  const [manual, setManual] = useState(false);

  const qs = new URLSearchParams();
  if (preset === 'custom') { if (from && to) { qs.set('from', from); qs.set('to', to); } else qs.set('range', 'today'); } else qs.set('range', preset);
  if (employeeId) qs.set('employeeId', employeeId);
  if (branchId) qs.set('branchId', branchId);
  if (status) qs.set('status', status);

  const { data, error, mutate, isLoading } = useSWR<Res>(`/app/attendance?${qs}`, fetcher, { keepPreviousData: true });
  const { data: emps } = useSWR<Emp[]>('/app/employees?all=1', fetcher);
  const { data: branches } = useSWR<Branch[]>('/app/branches', fetcher);
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const writable = me?.subscription.operational ?? true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-extrabold sm:text-3xl">Asistencias</h1>{data && <p className="text-ink-500">{data.range.from === data.range.to ? data.range.from : `${data.range.from} al ${data.range.to}`}</p>}</div>
        <div className="flex gap-2">
          {data && !data.plan.canExport ? (
            <button type="button" onClick={() => toast('La exportación a Excel está disponible en el plan Avanzado.', 'err')} className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 text-[15px] font-semibold text-ink-500"><Lock className="h-4 w-4" />Excel (CSV)</button>
          ) : (
            <a href={`/api/app/attendance/export.csv?${qs}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-[15px] font-semibold hover:bg-ink-50"><Download className="h-4 w-4" />Excel (CSV)</a>
          )}
          <Button onClick={() => setManual(true)} disabled={!writable}><Plus className="h-5 w-5" /><span className="hidden sm:inline">Registro manual</span><span className="sm:hidden">Manual</span></Button>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map(([k, l]) => (
          <button key={k} onClick={() => setPreset(k)} className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition', preset === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50')}>{l}</button>
        ))}
      </div>

      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {preset === 'custom' && (<>
          <Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </>)}
        <Field label="Empleado"><Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Todos</option>{emps?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        {(branches?.length ?? 0) > 1 && <Field label="Sucursal"><Select value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Todas</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
        <Field label="Estado"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="OPEN">En curso</option><option value="CLOSED">Completas</option><option value="INCOMPLETE">Incompletas</option></Select></Field>
      </Card>

      {data && (data.limited || data.plan.historyDays < 60 || !data.plan.canExport) && (
        <Link href="/panel/suscripcion" className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-900 transition hover:bg-brand-100">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <span className="text-sm"><strong>Tu plan {me?.subscription.planName ?? ''} muestra los últimos {data.plan.historyDays} días{!data.plan.canExport ? ' y no incluye exportación a Excel' : ''}.</strong> Con el plan Avanzado ves hasta 12 meses y descargas tus reportes. Tus registros anteriores no se pierden. <u className="font-semibold">Ver planes</u></span>
        </Link>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[['Jornadas', String(data.rows.length)], ['Horas trabajadas', hhmm(data.totals.workedMinutes)], ['Retardos', String(data.totals.late)]].map(([l, v]) => (
            <Card key={l} className="p-4 text-center"><p className="font-display text-2xl font-extrabold tabular-nums">{v}</p><p className="text-xs font-medium text-ink-500 sm:text-sm">{l}</p></Card>
          ))}
        </div>
      )}

      {error ? <ErrorBox message="No pudimos cargar las asistencias." onRetry={() => mutate()} />
        : !data || (isLoading && !data) ? <PageLoading />
        : data.rows.length === 0 ? <Empty title="Sin registros en este periodo">Prueba con otro rango o quita los filtros.</Empty>
        : <SessionsList rows={data.rows} writable={writable} onChanged={() => mutate()} />}

      {manual && <ManualModal emps={emps?.filter((e) => e) ?? []} onClose={() => setManual(false)} onSaved={() => { setManual(false); mutate(); toast('Registro guardado.'); }} />}
    </div>
  );
}

function ManualModal({ emps, onClose, onSaved }: { emps: Emp[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ employeeId: emps[0]?.id ?? '', start: '', end: '', reason: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function save() {
    setErr(''); setBusy(true);
    try {
      await api('/app/attendance/manual', { body: { employeeId: f.employeeId, startLocal: f.start.replace('T', ' '), endLocal: f.end.replace('T', ' '), reason: f.reason } });
      onSaved();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Registro manual de jornada">
      <p className="mb-4 text-sm text-ink-600">Úsalo cuando alguien no pudo checar. Queda marcado como corregido, con tu nombre y el motivo.</p>
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Field label="Empleado"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="Entrada"><Input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Salida"><Input type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="Motivo"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ej. Se cayó el internet" /></Field>
        <Button size="lg" className="w-full" onClick={save} loading={busy} disabled={!f.employeeId || !f.start || !f.end}>Guardar registro</Button>
      </div>
    </Modal>
  );
}

export default function Page() { return <Suspense fallback={<PageLoading />}><Attendance /></Suspense>; }
