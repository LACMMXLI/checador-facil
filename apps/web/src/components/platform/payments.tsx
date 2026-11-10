'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Check, X } from 'lucide-react';
import { api, errMsg, fetcher } from '@/lib/api';
import { Badge, Button, Empty, PageLoading, useToast } from '@/components/ui';
import { dateTimeEs, money } from '@/lib/format';

export interface Pay {
  id: string; tenantId: string; amountCents: number; currency: string; months: number; method: string; reference: string | null; notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; reportedAt: string; reviewedAt: string | null; tenant: { id: string; name: string };
}
const TONE = { PENDING: ['Por revisar', 'amber'], APPROVED: ['Aprobado', 'green'], REJECTED: ['Rechazado', 'red'] } as const;

export function PaymentsList({ status }: { status?: string }) {
  const toast = useToast();
  const { data, mutate } = useSWR<Pay[]>(`/platform/payments${status ? `?status=${status}` : ''}`, fetcher);
  const [busy, setBusy] = useState('');
  if (!data) return <PageLoading />;
  if (!data.length) return <Empty title="No hay pagos en esta lista" />;

  async function act(p: Pay, kind: 'approve' | 'reject') {
    const txt = kind === 'approve'
      ? `¿Confirmar que recibiste ${money(p.amountCents, p.currency)} de "${p.tenant.name}"? Se renovará su servicio ${p.months} mes(es).`
      : `¿Rechazar el pago reportado por "${p.tenant.name}"?`;
    if (!confirm(txt)) return;
    setBusy(p.id);
    try { await api(`/platform/payments/${p.id}/${kind}`, { body: {} }); toast(kind === 'approve' ? 'Pago aprobado y servicio renovado.' : 'Pago rechazado.'); mutate(); } catch (e) { toast(errMsg(e), 'err'); }
    setBusy('');
  }
  return (
    <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      {data.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link href={`/plataforma/clientes/${p.tenant.id}`} className="font-semibold hover:underline">{p.tenant.name}</Link>
            <p className="text-sm text-ink-500">{money(p.amountCents, p.currency)} · {p.months} mes{p.months > 1 ? 'es' : ''} · {p.method}{p.reference ? ` · ${p.reference}` : ''} · {dateTimeEs(p.reportedAt)}</p>
            {p.notes && <p className="text-sm text-ink-600">“{p.notes}”</p>}
          </div>
          {p.status === 'PENDING' ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(p, 'approve')} loading={busy === p.id}><Check className="h-4 w-4" />Aprobar</Button>
              <Button size="sm" variant="outline" onClick={() => act(p, 'reject')} disabled={busy === p.id}><X className="h-4 w-4" />Rechazar</Button>
            </div>
          ) : <Badge tone={TONE[p.status][1]}>{TONE[p.status][0]}</Badge>}
        </li>
      ))}
    </ul>
  );
}
export const PendingPayments = () => <PaymentsList status="PENDING" />;
