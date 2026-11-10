'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { History, Pencil } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, ErrorBox, Field, Input, Modal, Textarea, cn, useToast } from '@/components/ui';
import { SESSION_STATUS, hhmm, localDateEs } from '@/lib/format';

export interface SessionRow {
  id: string; employeeId: string; employeeName: string; employeeNumber: string; branchName: string; timezone: string;
  localDate: string; startLocal: string; endLocal: string | null; status: 'OPEN' | 'CLOSED' | 'INCOMPLETE';
  workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; corrected: boolean;
}

const toInput = (s: string | null) => (s ? s.replace(' ', 'T') : '');

export function SessionsList({ rows, onChanged, writable = true, showEmployee = true, showLate = true }: { rows: SessionRow[]; onChanged: () => void; writable?: boolean; showEmployee?: boolean; showLate?: boolean }) {
  const [editing, setEditing] = useState<SessionRow | null>(null);
  return (
    <>
      {/* Tabla en pantallas amplias */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>{showEmployee && <th className="px-4 py-3">Empleado</th>}<th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Horas</th>{showLate && <th className="px-4 py-3">Retardo</th>}<th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const st = SESSION_STATUS[r.status];
              return (
                <tr key={r.id} className="hover:bg-ink-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{localDateEs(r.localDate)}</td>
                  {showEmployee && <td className="px-4 py-3"><p className="font-semibold">{r.employeeName}</p><p className="text-xs text-ink-500">{r.branchName}</p></td>}
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.startLocal.slice(11)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.endLocal ? r.endLocal.slice(11) : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.endLocal ? hhmm(r.workedMinutes) : '—'}</td>
                  {showLate && <td className="whitespace-nowrap px-4 py-3">{r.lateMinutes > 0 ? <Badge tone="amber">{r.lateMinutes} min</Badge> : <span className="text-ink-400">—</span>}</td>}
                  <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-1"><Badge tone={st.tone}>{st.label}</Badge>{showLate && r.earlyLeaveMinutes > 0 && <Badge tone="amber">Salió {r.earlyLeaveMinutes} min antes</Badge>}{r.corrected && <Badge tone="gray">Corregida</Badge>}</div></td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" />{writable ? 'Corregir' : 'Ver'}</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Tarjetas en móvil */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => {
          const st = SESSION_STATUS[r.status];
          return (
            <li key={r.id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-semibold">{showEmployee ? r.employeeName : localDateEs(r.localDate)}</p><p className="text-xs text-ink-500">{showEmployee ? `${localDateEs(r.localDate)} · ` : ''}{r.branchName}</p></div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[['Entrada', r.startLocal.slice(11)], ['Salida', r.endLocal ? r.endLocal.slice(11) : '—'], ['Horas', r.endLocal ? hhmm(r.workedMinutes) : '—']].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-ink-50 py-2"><p className="text-[11px] text-ink-500">{l}</p><p className="font-bold tabular-nums">{v}</p></div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">{showLate && r.lateMinutes > 0 && <Badge tone="amber">Retardo {r.lateMinutes} min</Badge>}{showLate && r.earlyLeaveMinutes > 0 && <Badge tone="amber">Salió {r.earlyLeaveMinutes} min antes</Badge>}{r.corrected && <Badge>Corregida</Badge>}</div>
                <Button size="sm" variant="soft" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" />{writable ? 'Corregir' : 'Ver'}</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <CorrectModal row={editing} writable={writable} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </>
  );
}

interface Adjustment { id: string; oldStartAt: string | null; oldEndAt: string | null; newStartAt: string; newEndAt: string | null; reason: string; createdAt: string }

function CorrectModal({ row, writable, onClose, onSaved }: { row: SessionRow; writable: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState(toInput(row.startLocal));
  const [end, setEnd] = useState(toInput(row.endLocal));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: adj } = useSWR<Adjustment[]>(row.corrected ? `/app/attendance/${row.id}/adjustments` : null, fetcher);
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat('es-MX', { timeZone: row.timezone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');

  async function save() {
    setError('');
    if (reason.trim().length < 3) { setError('Escribe el motivo de la corrección.'); return; }
    setBusy(true);
    try {
      await api(`/app/attendance/${row.id}/correct`, { body: { startLocal: start.replace('T', ' '), endLocal: end ? end.replace('T', ' ') : null, reason } });
      toast('Corrección guardada.'); onSaved();
    } catch (e) { setError(errMsg(e)); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={writable ? 'Corregir jornada' : 'Detalle de jornada'} wide>
      <p className="mb-4 text-sm text-ink-600"><strong>{row.employeeName}</strong> · {localDateEs(row.localDate)} · {row.branchName}. Las horas están en la zona horaria de la sucursal.</p>
      {writable && (
        <div className="space-y-4">
          {error && <ErrorBox message={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrada"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Salida" hint="Déjala vacía si aún no ha salido."><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Motivo de la corrección" hint="Quedará guardado junto con tu nombre y la fecha."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Olvidó checar su salida" /></Field>
          <p className="text-xs text-ink-500">El registro original no se borra: se conserva el valor anterior, el nuevo, el motivo y quién lo cambió.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>Guardar corrección</Button></div>
        </div>
      )}
      {row.corrected && (
        <div className={cn(writable && 'mt-6 border-t border-ink-100 pt-4')}>
          <h3 className="mb-2 flex items-center gap-2 font-display font-bold"><History className="h-4 w-4" />Historial de cambios</h3>
          {!adj ? <p className="text-sm text-ink-500">Cargando…</p> : (
            <ul className="space-y-2">
              {adj.map((a) => (
                <li key={a.id} className="rounded-xl bg-ink-50 p-3 text-sm">
                  <p className="font-semibold">“{a.reason}”</p>
                  <p className="text-ink-600">Antes: {fmt(a.oldStartAt)} → {fmt(a.oldEndAt)}</p>
                  <p className="text-ink-600">Ahora: {fmt(a.newStartAt)} → {fmt(a.newEndAt)}</p>
                  <p className="text-xs text-ink-400">Registrado el {fmt(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
