'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, PageLoading, Select, Textarea, useToast } from '@/components/ui';
import { SUB_STATUS, dateEs, money } from '@/lib/format';

interface Sub {
  status: string; operational: boolean; periodEnd: string | null; daysLeft: number | null; graceDays: number;
  plan: { name: string; priceMonthlyCents: number; currency: string; maxEmployees: number; maxBranches: number; historyDays: number; canExport: boolean; canSchedules: boolean; canLateControl: boolean };
  usage: { employees: number; branches: number };
  paymentInstructions: string; contactEmail: string; contactWhatsapp: string;
  payments: { id: string; amountCents: number; currency: string; months: number; reference: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reportedAt: string }[];
}
const PAY = { PENDING: ['En revisión', 'amber'], APPROVED: ['Confirmado', 'green'], REJECTED: ['Rechazado', 'red'] } as const;

export default function Subscription() {
  const toast = useToast();
  const { data, error, mutate } = useSWR<Sub>('/app/subscription', fetcher);
  const [months, setMonths] = useState(1); const [reference, setReference] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorBox message="No pudimos cargar tu suscripción." onRetry={() => mutate()} />;
  if (!data) return <PageLoading />;
  const st = SUB_STATUS[data.status];

  async function report(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api('/app/subscription/payments', { body: { months, reference: reference || undefined, notes: notes || undefined } });
      toast('Recibimos tu reporte. Lo revisaremos y activaremos tu servicio.'); setReference(''); setNotes(''); mutate();
    } catch (err) { toast(errMsg(err), 'err'); }
    setBusy(false);
  }
  const wa = data.contactWhatsapp.replace(/\D/g, '');

  return (
    <div className="space-y-6">
      <Link href="/panel/configuracion" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />Configuración</Link>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Mi suscripción</h1>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm text-ink-500">Plan</p><p className="font-display text-2xl font-extrabold">{data.plan.name}</p><p className="text-ink-600">{money(data.plan.priceMonthlyCents, data.plan.currency)} {data.plan.currency} al mes</p></div>
          <Badge tone={st.tone} className="text-sm">{st.label}</Badge>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-ink-500">{data.status === 'TRIAL' ? 'La prueba termina' : 'Vigente hasta'}</dt><dd className="font-semibold">{dateEs(data.periodEnd)}{data.daysLeft !== null && data.daysLeft >= 0 && <span className="text-ink-500"> ({data.daysLeft} día{data.daysLeft === 1 ? '' : 's'})</span>}</dd></div>
          <div><dt className="text-sm text-ink-500">Empleados activos</dt><dd className="font-semibold">{data.usage.employees} de {data.plan.maxEmployees}</dd></div>
          <div><dt className="text-sm text-ink-500">Sucursales</dt><dd className="font-semibold">{data.usage.branches} de {data.plan.maxBranches}</dd></div>
          <div><dt className="text-sm text-ink-500">Historial de reportes</dt><dd className="font-semibold">Últimos {data.plan.historyDays} días</dd></div>
          <div><dt className="text-sm text-ink-500">Horarios y turnos nocturnos</dt><dd className="font-semibold">{data.plan.canSchedules ? 'Incluido' : 'No incluido en tu plan'}</dd></div>
          <div><dt className="text-sm text-ink-500">Control de retardos</dt><dd className="font-semibold">{data.plan.canLateControl ? 'Incluido' : 'No incluido en tu plan'}</dd></div>
          <div><dt className="text-sm text-ink-500">Exportar a Excel</dt><dd className="font-semibold">{data.plan.canExport ? 'Incluido' : 'No incluido en tu plan'}</dd></div>
        </dl>
        {(!data.plan.canExport || !data.plan.canSchedules || data.plan.historyDays < 60) && (
          <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">¿Necesitas horarios y turnos nocturnos, control de retardos, más empleados, más sucursales, 12 meses de historial o exportar a Excel? Pide el cambio al plan Avanzado con el contacto de abajo: tus datos se conservan y recuperas todo al instante.</p>
        )}
        {!data.operational && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Tu servicio está suspendido. Tus datos están a salvo: puedes consultarlos y exportarlos. Para volver a checar y editar, realiza tu pago y repórtalo aquí.</p>}
        {data.status === 'GRACE_PERIOD' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tu periodo venció; tienes {data.graceDays} día(s) de gracia antes de la suspensión.</p>}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Cómo pagar</h2>
        <p className="mt-2 whitespace-pre-line text-ink-700">{data.paymentInstructions}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          {data.contactEmail && <a className="inline-flex items-center gap-1.5 text-brand-700 hover:underline" href={`mailto:${data.contactEmail}`}><Mail className="h-4 w-4" />{data.contactEmail}</a>}
          {wa && <a className="inline-flex items-center gap-1.5 text-brand-700 hover:underline" href={`https://wa.me/${wa}`} rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Ya hice mi pago</h2>
        <p className="mt-1 text-sm text-ink-500">Avísanos para que lo confirmemos. El servicio se activa o renueva cuando verificamos el pago, no al enviar este aviso.</p>
        <form onSubmit={report} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="¿Cuántos meses pagaste?"><Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mes{m > 1 ? 'es' : ''} — {money(data.plan.priceMonthlyCents * m, data.plan.currency)}</option>)}</Select></Field>
            <Field label="Referencia o folio" hint="Número de rastreo, últimos dígitos, etc."><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </div>
          <Field label="Comentarios (opcional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button type="submit" loading={busy}>Reportar mi pago</Button>
        </form>
      </Card>

      {data.payments.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Historial de pagos</h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div><p className="font-semibold">{money(p.amountCents, p.currency)} · {p.months} mes{p.months > 1 ? 'es' : ''}</p><p className="text-sm text-ink-500">{dateEs(p.reportedAt)}{p.reference ? ` · ${p.reference}` : ''}</p></div>
                <Badge tone={PAY[p.status][1]}>{PAY[p.status][0]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
