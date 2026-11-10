'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Copy, KeyRound, Lock, Mail, UserX, UserCheck } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, PageLoading, Select, useToast } from '@/components/ui';
import { DAYS, DAYS_ORDER, minutesToTime, timeToMinutes } from '@/lib/format';
import { SessionsList, type SessionRow } from '@/components/panel/sessions';
import type { Me } from '../../layout';

interface Emp {
  id: string; name: string; employeeNumber: string; phone: string | null; active: boolean; branch: { id: string; name: string }; hasPin: boolean;
  account: { email: string; activated: boolean } | null; schedule: { dayOfWeek: number; isRest: boolean; startMinutes: number; endMinutes: number }[];
}
interface Branch { id: string; name: string; active: boolean }
type Day = { work: boolean; start: string; end: string };

export default function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: emp, error, mutate } = useSWR<Emp>(`/app/employees/${id}`, fetcher);
  const { data: branches } = useSWR<Branch[]>('/app/branches', fetcher);
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const { data: hist, mutate: mutateHist } = useSWR<{ rows: SessionRow[] }>(`/app/attendance?employeeId=${id}&range=month`, fetcher);

  const [info, setInfo] = useState({ name: '', employeeNumber: '', phone: '', branchId: '' });
  const [days, setDays] = useState<Record<number, Day>>({});
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const writable = me?.subscription.operational ?? true;
  const canSched = me?.subscription.plan.canSchedules ?? false;
  const schedOk = writable && canSched;

  useEffect(() => {
    if (!emp) return;
    setInfo({ name: emp.name, employeeNumber: emp.employeeNumber, phone: emp.phone ?? '', branchId: emp.branch.id });
    setEmail(emp.account?.email ?? '');
    const d: Record<number, Day> = {};
    for (let i = 0; i < 7; i++) {
      const s = emp.schedule.find((x) => x.dayOfWeek === i);
      d[i] = s && !s.isRest ? { work: true, start: minutesToTime(s.startMinutes), end: minutesToTime(s.endMinutes) } : { work: false, start: '09:00', end: '17:00' };
    }
    setDays(d);
  }, [emp]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast(errMsg(e), 'err'); }
    setBusy('');
  }

  if (error) return <ErrorBox message="No encontramos a este empleado." />;
  if (!emp || !branches) return <PageLoading />;

  const saveInfo = () => run('info', async () => {
    await api(`/app/employees/${id}`, { method: 'PATCH', body: { name: info.name, employeeNumber: info.employeeNumber, phone: info.phone || null, branchId: info.branchId } });
    toast('Datos guardados.'); mutate();
  });
  const toggleActive = () => run('active', async () => {
    await api(`/app/employees/${id}`, { method: 'PATCH', body: { active: !emp.active } });
    toast(emp.active ? 'Empleado desactivado.' : 'Empleado reactivado.'); mutate();
  });
  const newPin = () => run('pin', async () => { const r = await api<{ pin: string }>(`/app/employees/${id}/pin`, { body: {} }); setPin(r.pin); });
  const saveSchedule = () => run('sched', async () => {
    const schedule = Object.entries(days).map(([d, v]) => ({
      dayOfWeek: Number(d), isRest: !v.work, startMinutes: v.work ? timeToMinutes(v.start) : 0, endMinutes: v.work ? timeToMinutes(v.end) : 0,
    }));
    await api(`/app/employees/${id}/schedule`, { method: 'PUT', body: { schedule } });
    toast('Horario guardado.'); mutate();
  });
  const invite = () => run('invite', async () => {
    const r = await api<{ link: string }>(`/app/employees/${id}/invite`, { body: { email } });
    setLink(r.link); toast('Invitación creada.'); mutate();
  });
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copiado.'); } catch { toast('No se pudo copiar. Selecciónalo manualmente.', 'err'); } };
  const copyFirstToAll = () => { const first = days[DAYS_ORDER.find((d) => days[d]?.work) ?? 1]; if (!first) return; const n = { ...days }; for (const d of DAYS_ORDER) if (n[d].work) n[d] = { ...first, work: true }; setDays(n); };
  const crosses = (v: Day) => v.work && timeToMinutes(v.end) <= timeToMinutes(v.start);

  return (
    <div className="space-y-6">
      <Link href="/panel/empleados" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />Empleados</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{emp.name}</h1>
        {!emp.active && <Badge tone="red">Desactivado</Badge>}
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold">Datos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} disabled={!writable} /></Field>
          <Field label="Número de empleado"><Input value={info.employeeNumber} onChange={(e) => setInfo({ ...info, employeeNumber: e.target.value })} disabled={!writable} /></Field>
          <Field label="Teléfono (opcional)"><Input type="tel" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} disabled={!writable} /></Field>
          <Field label="Sucursal"><Select value={info.branchId} onChange={(e) => setInfo({ ...info, branchId: e.target.value })} disabled={!writable}>{branches.filter((b) => b.active || b.id === info.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveInfo} loading={busy === 'info'} disabled={!writable}>Guardar datos</Button>
          <Button variant={emp.active ? 'outline' : 'soft'} onClick={toggleActive} loading={busy === 'active'} disabled={!writable}>
            {emp.active ? <><UserX className="h-4 w-4" />Desactivar</> : <><UserCheck className="h-4 w-4" />Reactivar</>}
          </Button>
        </div>
        {emp.active && <p className="mt-3 text-xs text-ink-500">Al desactivar, el empleado ya no puede checar, pero su historial se conserva.</p>}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Horario semanal</h2>
        {!canSched && (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span><strong>Horarios y turnos nocturnos son del plan Avanzado.</strong> Con ellos calculas retardos y salidas anticipadas por empleado. <Link href="/panel/suscripcion" className="font-semibold underline">Ver mi plan</Link></span>
          </div>
        )}
        <p className="mt-1 text-sm text-ink-500">Se usa para calcular retardos y salidas anticipadas. Si la salida es menor que la entrada, el turno termina al día siguiente (turno nocturno).</p>
        <div className="mt-4 space-y-2">
          {DAYS_ORDER.map((d) => {
            const v = days[d]; if (!v) return null;
            return (
              <div key={d} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-100 p-3">
                <label className="flex w-32 items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5 rounded" checked={v.work} disabled={!schedOk} onChange={(e) => setDays({ ...days, [d]: { ...v, work: e.target.checked } })} />{DAYS[d]}</label>
                {v.work ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="h-10 w-32" value={v.start} disabled={!schedOk} onChange={(e) => setDays({ ...days, [d]: { ...v, start: e.target.value } })} aria-label={`Entrada ${DAYS[d]}`} />
                    <span className="text-ink-400">a</span>
                    <Input type="time" className="h-10 w-32" value={v.end} disabled={!schedOk} onChange={(e) => setDays({ ...days, [d]: { ...v, end: e.target.value } })} aria-label={`Salida ${DAYS[d]}`} />
                    {crosses(v) && <Badge tone="blue">Termina al día siguiente</Badge>}
                  </div>
                ) : <span className="text-sm text-ink-400">Descanso</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveSchedule} loading={busy === 'sched'} disabled={!schedOk}>Guardar horario</Button>
          <Button variant="outline" onClick={copyFirstToAll} disabled={!schedOk}>Copiar el primer día a los demás días de trabajo</Button>
        </div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound className="h-5 w-5" />PIN de checada</h2>
        <p className="mt-1 text-sm text-ink-500">{emp.hasPin ? 'Este empleado tiene PIN. Por seguridad no se puede consultar, sólo generar uno nuevo.' : 'Aún no tiene PIN.'}</p>
        {pin && <p className="my-3 inline-block rounded-2xl bg-ink-900 px-5 py-3 font-display text-3xl font-extrabold tracking-[.25em] text-white">{pin}</p>}
        {pin && <p className="text-sm text-amber-800">Anótalo ahora: no se volverá a mostrar. El PIN anterior ya no sirve.</p>}
        <div className="mt-3"><Button variant="outline" onClick={newPin} loading={busy === 'pin'} disabled={!writable || !emp.active}>Generar nuevo PIN</Button></div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Mail className="h-5 w-5" />Acceso personal desde su celular</h2>
        <p className="mt-1 text-sm text-ink-500">Para checar escaneando el QR, el empleado necesita su propia cuenta. Se le envía un enlace para crear su contraseña (o puedes compartirlo tú por WhatsApp).</p>
        {emp.account && <p className="mt-2 text-sm">Estado: {emp.account.activated ? <Badge tone="green">Cuenta activa</Badge> : <Badge tone="amber">Invitación pendiente</Badge>}</p>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!writable || !emp.active} />
          <Button onClick={invite} loading={busy === 'invite'} disabled={!email || !writable || !emp.active}>{emp.account ? 'Enviar nueva invitación' : 'Invitar'}</Button>
        </div>
        {link && (
          <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm">
            <p className="font-semibold">Enlace de invitación (vence en 7 días):</p>
            <p className="mt-1 break-all text-ink-600">{link}</p>
            <Button size="sm" variant="soft" className="mt-2" onClick={() => copy(link)}><Copy className="h-4 w-4" />Copiar enlace</Button>
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Historial del mes</h2>
        {!hist ? <PageLoading /> : hist.rows.length === 0 ? <p className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-ink-500">Sin registros este mes.</p>
          : <SessionsList rows={hist.rows} showEmployee={false} showLate={me?.subscription.plan.canLateControl ?? false} writable={writable} onChanged={() => mutateHist()} />}
      </section>
    </div>
  );
}
