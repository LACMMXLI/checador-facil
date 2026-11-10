'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { CalendarCheck, CreditCard, Home, LogOut, Settings, Users, AlertTriangle } from 'lucide-react';
import { api, ApiError, fetcher } from '@/lib/api';
import { Logo, PageLoading, cn } from '@/components/ui';
import { SUB_STATUS } from '@/lib/format';

export interface Me {
  user: { id: string; name: string; email: string }; tenant: { id: string; name: string }; role: string;
  subscription: { status: string; operational: boolean; planName: string; periodEnd: string | null; daysLeft: number | null };
}

const NAV = [
  { href: '/panel', label: 'Inicio', icon: Home },
  { href: '/panel/empleados', label: 'Empleados', icon: Users },
  { href: '/panel/asistencias', label: 'Asistencias', icon: CalendarCheck },
  { href: '/panel/configuracion', label: 'Configuración', icon: Settings },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: me, error } = useSWR<Me>('/auth/me', fetcher, { revalidateOnFocus: true, shouldRetryOnError: false });

  useEffect(() => { if (error instanceof ApiError && error.status === 401) router.replace('/login'); }, [error, router]);

  if (!me) return <PageLoading />;
  const sub = me.subscription;
  const st = SUB_STATUS[sub.status];
  const isActive = (href: string) => (href === '/panel' ? path === '/panel' : path.startsWith(href));
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined); router.push('/login'); };

  return (
    <div className="min-h-dvh bg-ink-50 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white p-4 lg:flex">
        <Link href="/panel" className="px-2 py-3"><Logo /></Link>
        <p className="mb-4 mt-2 truncate px-2 text-sm font-semibold text-ink-500">{me.tenant.name}</p>
        <nav className="flex-1 space-y-1" aria-label="Panel">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition', isActive(n.href) ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50')}>
              <n.icon className="h-5 w-5" />{n.label}
            </Link>
          ))}
          <Link href="/panel/suscripcion" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition', isActive('/panel/suscripcion') ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50')}>
            <CreditCard className="h-5 w-5" />Suscripción
          </Link>
        </nav>
        <div className="border-t border-ink-100 pt-3">
          <p className="truncate px-2 text-sm font-semibold">{me.user.name}</p>
          <p className="truncate px-2 text-xs text-ink-500">{me.user.email}</p>
          <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50"><LogOut className="h-4 w-4" />Cerrar sesión</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo className="text-base" />
          <button onClick={logout} className="rounded-lg p-2 text-ink-500" aria-label="Cerrar sesión"><LogOut className="h-5 w-5" /></button>
        </header>

        {sub.status !== 'ACTIVE' && (
          <Link href="/panel/suscripcion" className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold',
            !sub.operational ? 'bg-red-600 text-white' : sub.status === 'TRIAL' ? 'bg-brand-600 text-white' : 'bg-amber-500 text-ink-950')}>
            {!sub.operational || sub.status !== 'TRIAL' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : null}
            <span className="flex-1">
              {!sub.operational ? 'Tu suscripción está suspendida: puedes consultar y exportar, pero no checar ni editar. Toca para renovar.'
                : sub.status === 'TRIAL' ? `Prueba gratis: te quedan ${Math.max(sub.daysLeft ?? 0, 0)} día(s). Toca para ver cómo continuar.`
                : `Tu pago está pendiente (${st?.label}). Renueva para no perder el servicio.`}
            </span>
          </Link>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-100 bg-white/95 backdrop-blur lg:hidden" aria-label="Panel">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive(n.href) ? 'text-brand-600' : 'text-ink-400')}>
              <n.icon className="h-6 w-6" />{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
