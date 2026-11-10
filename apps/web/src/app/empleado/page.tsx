'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, Camera, LogOut } from 'lucide-react';
import { api, ApiError, fetcher } from '@/lib/api';
import { Badge, Logo, PageLoading, buttonVariants, cn } from '@/components/ui';
import { SESSION_STATUS, hhmm, localDateEs } from '@/lib/format';

interface Me {
  name: string; tenantName: string; branchName: string; punchMode: string; operational: boolean; working: boolean; since: string | null; canScan: boolean;
  lastPunch: { type: 'IN' | 'OUT'; local: string } | null;
}
interface Hist { id: string; localDate: string; startLocal: string; endLocal: string | null; status: 'OPEN' | 'CLOSED' | 'INCOMPLETE'; workedMinutes: number; lateMinutes: number }

export default function EmployeeHome() {
  const router = useRouter();
  const { data: me, error } = useSWR<Me>('/employee/me', fetcher, { shouldRetryOnError: false, revalidateOnFocus: true });
  const { data: hist } = useSWR<Hist[]>('/employee/history?limit=15', fetcher, { revalidateOnFocus: true });
  useEffect(() => { if (error instanceof ApiError && error.status === 401) router.replace('/empleado/login'); }, [error, router]);
  if (!me) return <PageLoading />;
  const logout = async () => { await api('/employee/logout', { body: {} }).catch(() => undefined); router.push('/empleado/login'); };

  return (
    <div>
      <div className="flex items-center justify-between"><Logo className="text-base" /><button onClick={logout} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-500 hover:bg-ink-100"><LogOut className="h-4 w-4" />Salir</button></div>

      <h1 className="mt-8 font-display text-3xl font-extrabold">Hola, {me.name.split(' ')[0]} 👋</h1>
      <p className="text-ink-600">{me.tenantName} · {me.branchName}</p>

      <div className={cn('mt-6 rounded-3xl p-6 text-center shadow-soft', me.working ? 'bg-mint-50 ring-1 ring-mint-500/20' : 'bg-white ring-1 ring-ink-100')}>
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Tu estado</p>
        <p className={cn('mt-1 font-display text-2xl font-extrabold', me.working ? 'text-mint-700' : 'text-ink-800')}>{me.working ? 'Trabajando' : 'Sin jornada abierta'}</p>
        <p className="mt-1 text-ink-600">{me.working ? `Entrada a las ${me.since?.slice(11)}` : me.lastPunch ? `Última checada: ${me.lastPunch.type === 'IN' ? 'entrada' : 'salida'} · ${me.lastPunch.local}` : 'Aún no has checado'}</p>
      </div>

      {!me.operational ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm font-medium">El servicio de tu negocio está suspendido por ahora. Avisa a tu encargado.</p></div>
      ) : me.canScan ? (
        <Link href="/empleado/escanear" className={cn(buttonVariants({ size: 'lg' }), 'mt-6 h-20 w-full gap-3 rounded-3xl text-xl')}><Camera className="h-7 w-7" />Escanear QR</Link>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-4 text-center text-sm text-ink-600 ring-1 ring-ink-100">Tu sucursal registra asistencia con PIN en el checador del local.</div>
      )}

      <h2 className="mb-3 mt-9 font-display text-lg font-bold">Mi historial</h2>
      {!hist ? <PageLoading /> : hist.length === 0 ? <p className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">Todavía no tienes registros.</p> : (
        <ul className="space-y-2">
          {hist.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100">
              <div>
                <p className="font-semibold">{localDateEs(h.localDate)}</p>
                <p className="text-sm tabular-nums text-ink-500">{h.startLocal.slice(11)} → {h.endLocal ? h.endLocal.slice(11) : '—'}{h.endLocal ? ` · ${hhmm(h.workedMinutes)} h` : ''}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={SESSION_STATUS[h.status].tone}>{SESSION_STATUS[h.status].label}</Badge>
                {h.lateMinutes > 0 && <Badge tone="amber">Retardo {h.lateMinutes} min</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
