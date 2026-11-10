'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, Clock, LogIn, UserCheck, Users, PartyPopper } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { Badge, Card, Empty, ErrorBox, PageLoading, buttonVariants, cn } from '@/components/ui';
import { EMP_STATUS } from '@/lib/format';
import type { Me } from './layout';

interface Dash {
  activeEmployees: number; working: number; entriesToday: number; lates: number; incidents: number;
  employees: { id: string; name: string; employeeNumber: string; branchName: string; status: string; since: string | null; lateMinutes: number }[];
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl', tone)}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm font-medium text-ink-500">{label}</p>
    </Card>
  );
}

function Home() {
  const sp = useSearchParams();
  const { data, error, mutate } = useSWR<Dash>('/app/dashboard', fetcher, { refreshInterval: 20_000 });
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const late = me?.subscription.plan.canLateControl ?? false;
  if (error) return <ErrorBox message="No pudimos cargar tu tablero." onRetry={() => mutate()} />;
  if (!data) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Hola{me ? `, ${me.user.name.split(' ')[0]}` : ''} 👋</h1>
        <p className="text-ink-500">Así va tu equipo hoy.</p>
      </div>

      {sp.get('bienvenida') && (
        <Card className="border-brand-200 bg-brand-50">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-brand-800"><PartyPopper className="h-5 w-5" /> ¡Bienvenido! Tu prueba gratis ya está activa.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li><Link href="/panel/empleados" className="font-semibold text-brand-700 underline">Agrega a tus empleados</Link> y configura su horario.</li>
            <li><Link href="/panel/configuracion" className="font-semibold text-brand-700 underline">Vincula una tableta</Link> como checador con un código temporal.</li>
            <li>Tus empleados checan con el QR o con su PIN. ¡Listo!</li>
          </ol>
        </Card>
      )}

      <div className={`grid grid-cols-2 gap-3 ${late ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Stat icon={Users} label="Empleados activos" value={data.activeEmployees} tone="bg-brand-50 text-brand-600" />
        <Stat icon={UserCheck} label="Trabajando ahora" value={data.working} tone="bg-mint-50 text-mint-600" />
        <Stat icon={LogIn} label="Entradas de hoy" value={data.entriesToday} tone="bg-sky-50 text-sky-600" />
        {late && <Stat icon={Clock} label="Retardos hoy" value={data.lates} tone="bg-amber-50 text-amber-600" />}
      </div>

      {data.incidents > 0 && (
        <Link href="/panel/asistencias?status=INCOMPLETE" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <span className="flex-1 font-semibold">{data.incidents} jornada(s) incompleta(s) por revisar <span className="font-normal">— alguien olvidó checar su salida.</span></span>
          <span className="text-sm font-bold underline">Revisar</span>
        </Link>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Tu equipo hoy</h2>
        {data.employees.length === 0 ? (
          <Empty title="Aún no tienes empleados">
            <Link href="/panel/empleados" className={cn(buttonVariants({ size: 'sm' }), 'mt-2')}>Agregar mi primer empleado</Link>
          </Empty>
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            {data.employees.map((e) => {
              const st = EMP_STATUS[e.status];
              return (
                <li key={e.id}>
                  <Link href={`/panel/empleados/${e.id}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-ink-50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{e.name}</p>
                      <p className="truncate text-sm text-ink-500">{e.branchName}{e.since ? ` · Entrada ${e.since.slice(11)}` : ''}{e.lateMinutes > 0 ? ` · ${e.lateMinutes} min tarde` : ''}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<PageLoading />}><Home /></Suspense>; }
