'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo, buttonVariants, cn } from '@/components/ui';

const links = [
  { href: '/#beneficios', label: 'Beneficios' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#demo', label: 'Producto' },
  { href: '/#precios', label: 'Precios' },
  { href: '/#preguntas', label: 'Preguntas' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/80 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label="Inicio"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {links.map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Iniciar sesión</Link>
          <Link href="/registro" className={buttonVariants({ size: 'sm' })}>Comenzar prueba gratis</Link>
        </div>
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div className={cn('border-t border-ink-100 bg-white lg:hidden', open ? 'block' : 'hidden')}>
        <div className="container-x flex flex-col gap-1 py-3">
          {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50">{l.label}</Link>)}
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline' }), 'mt-2')}>Iniciar sesión</Link>
          <Link href="/registro" className={buttonVariants()}>Comenzar prueba gratis</Link>
        </div>
      </div>
    </header>
  );
}
