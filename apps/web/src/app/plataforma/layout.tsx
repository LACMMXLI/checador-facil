'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { Banknote, Building2, LayoutDashboard, LogOut, Settings, Tags } from 'lucide-react';
import { api, ApiError, fetcher } from '@/lib/api';
import { Logo, PageLoading, cn } from '@/components/ui';

const NAV = [
  { href: '/plataforma', label: 'Resumen', icon: LayoutDashboard },
  { href: '/plataforma/clientes', label: 'Clientes', icon: Building2 },
  { href: '/plataforma/pagos', label: 'Pagos', icon: Banknote },
  { href: '/plataforma/planes', label: 'Planes', icon: Tags },
  { href: '/plataforma/ajustes', label: 'Ajustes', icon: Settings },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isLogin = path === '/plataforma/login';
  const { data: me, error } = useSWR<{ email: string; mfaEnabled: boolean }>(isLogin ? null : '/platform/me', fetcher, { shouldRetryOnError: false });
  useEffect(() => { if (error instanceof ApiError && error.status === 401) router.replace('/plataforma/login'); }, [error, router]);

  if (isLogin) return <div className="min-h-dvh bg-ink-950">{children}</div>;
  if (!me) return <PageLoading />;
  const active = (h: string) => (h === '/plataforma' ? path === h : path.startsWith(h));
  const logout = async () => { await api('/platform/logout', { body: {} }).catch(() => undefined); router.push('/plataforma/login'); };

  return (
    <div className="min-h-dvh bg-ink-50 lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink-950 p-4 text-white lg:flex">
        <div className="px-2 py-3"><Logo dark /><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand-300">Administración SaaS</p></div>
        <nav className="mt-4 flex-1 space-y-1">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition', active(n.href) ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5')}><n.icon className="h-5 w-5" />{n.label}</Link>)}
        </nav>
        <p className="truncate px-2 text-xs text-ink-400">{me.email}</p>
        <button onClick={logout} className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-300 hover:bg-white/5"><LogOut className="h-4 w-4" />Cerrar sesión</button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-950 px-4 py-3 text-white lg:hidden"><Logo dark className="text-base" /><button onClick={logout} aria-label="Cerrar sesión"><LogOut className="h-5 w-5" /></button></header>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto bg-ink-900 px-3 py-2 lg:hidden">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', active(n.href) ? 'bg-white/15 text-white' : 'text-ink-300')}><n.icon className="h-4 w-4" />{n.label}</Link>)}
        </nav>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
