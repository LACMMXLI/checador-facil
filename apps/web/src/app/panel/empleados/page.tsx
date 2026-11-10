'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronRight, Plus, KeyRound, Smartphone } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageLoading, Select, useToast } from '@/components/ui';

interface Emp { id: string; name: string; employeeNumber: string; active: boolean; branch: { id: string; name: string }; hasSchedule: boolean; account: { email: string; activated: boolean } | null }
interface Branch { id: string; name: string; active: boolean }

export default function Employees() {
  const router = useRouter();
  const toast = useToast();
  const [all, setAll] = useState(false);
  const { data, error, mutate } = useSWR<Emp[]>(`/app/employees${all ? '?all=1' : ''}`, fetcher);
  const { data: branches } = useSWR<Branch[]>('/app/branches', fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', branchId: '', employeeNumber: '', phone: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; pin: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ id: string; name: string; pin: string }>('/app/employees', {
        body: { name: form.name, branchId: form.branchId || branches?.find((b) => b.active)?.id, employeeNumber: form.employeeNumber || undefined, phone: form.phone || undefined },
      });
      setOpen(false); setForm({ name: '', branchId: '', employeeNumber: '', phone: '' }); setCreated(r); mutate();
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  }

  if (error) return <ErrorBox message="No pudimos cargar a tus empleados." onRetry={() => mutate()} />;
  if (!data || !branches) return <PageLoading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-extrabold sm:text-3xl">Empleados</h1><p className="text-ink-500">{data.filter((e) => e.active).length} activos</p></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-5 w-5" />Agregar</Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 rounded" />Mostrar también empleados desactivados</label>

      {data.length === 0 ? (
        <Empty title="Aún no tienes empleados">Agrega el primero: sólo necesitas su nombre. Se le genera un PIN automáticamente.</Empty>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          {data.map((e) => (
            <li key={e.id}>
              <Link href={`/panel/empleados/${e.id}`} className="flex items-center gap-3 p-4 transition hover:bg-ink-50">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 font-display font-bold text-brand-700">{e.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.name} <span className="font-normal text-ink-400">#{e.employeeNumber}</span></p>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-500">{e.branch.name}
                    {!e.hasSchedule && <span className="text-amber-600">· Sin horario</span>}
                    {e.account && <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" />{e.account.activated ? 'Cuenta activa' : 'Invitación pendiente'}</span>}
                  </p>
                </div>
                {!e.active && <Badge>Desactivado</Badge>}
                <ChevronRight className="h-5 w-5 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar empleado">
        <form onSubmit={create} className="space-y-4">
          {err && <ErrorBox message={err} />}
          <Field label="Nombre completo"><Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          {branches.filter((b) => b.active).length > 1 && (
            <Field label="Sucursal"><Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>{branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número de empleado" hint="Opcional. Se asigna solo."><Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></Field>
            <Field label="Teléfono" hint="Opcional."><Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Guardar empleado</Button>
        </form>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Empleado agregado">
        {created && (
          <div className="text-center">
            <p className="text-ink-600"><strong>{created.name}</strong> ya puede checar con este PIN:</p>
            <p className="my-4 inline-flex items-center gap-3 rounded-2xl bg-ink-900 px-6 py-4 font-display text-4xl font-extrabold tracking-[.25em] text-white"><KeyRound className="h-6 w-6 text-brand-300" />{created.pin}</p>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Anótalo y entrégaselo ahora: por seguridad <strong>no se vuelve a mostrar</strong>. Si lo olvida, puedes generar uno nuevo.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => setCreated(null)}>Listo</Button>
              <Button onClick={() => router.push(`/panel/empleados/${created.id}`)}>Configurar horario</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
