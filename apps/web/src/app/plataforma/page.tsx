'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Card, ErrorBox, PageLoading } from '@/components/ui';
import { money } from '@/lib/format';
import { PendingPayments } from '@/components/platform/payments';

interface M {
  tenants: number; active: number; trial: number; grace: number; overdue: number; canceled: number; expiringSoon: number; newTenants30d: number;
  pendingPayments: number; revenueTotalCents: number; revenueMonthCents: number;
}

export default function Overview() {
  const { data, error, mutate } = useSWR<M>('/platform/metrics', fetcher, { refreshInterval: 30_000 });
  if (error) return <ErrorBox message="No pudimos cargar los indicadores." onRetry={() => mutate()} />;
  if (!data) return <PageLoading />;
  const cards: [string, string, string?][] = [
    ['Negocios registrados', String(data.tenants)], ['Activos (pagando)', String(data.active)], ['En prueba gratis', String(data.trial)],
    ['En gracia / pago pendiente', String(data.grace)], ['Suscripciones vencidas', String(data.overdue)], ['Vencen en 7 días', String(data.expiringSoon)],
    ['Clientes nuevos (30 días)', String(data.newTenants30d)], ['Pagos por revisar', String(data.pendingPayments), '/plataforma/pagos'],
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Resumen</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([l, v, href]) => {
          const inner = <Card className="h-full p-4"><p className="font-display text-3xl font-extrabold tabular-nums">{v}</p><p className="text-sm font-medium text-ink-500">{l}</p></Card>;
          return href ? <Link key={l} href={href}>{inner}</Link> : <div key={l}>{inner}</div>;
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><p className="text-sm text-ink-500">Ingresos registrados este mes</p><p className="font-display text-3xl font-extrabold">{money(data.revenueMonthCents)}</p></Card>
        <Card><p className="text-sm text-ink-500">Ingresos registrados (total)</p><p className="font-display text-3xl font-extrabold">{money(data.revenueTotalCents)}</p></Card>
      </div>
      <p className="text-xs text-ink-500">Las cifras salen únicamente de pagos aprobados o registrados manualmente en la plataforma. Los negocios de demostración no se cuentan.</p>
      <section><h2 className="mb-3 font-display text-lg font-bold">Pagos reportados por revisar</h2><PendingPayments /></section>
    </div>
  );
}
