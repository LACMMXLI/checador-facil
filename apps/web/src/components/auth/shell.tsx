import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/ui';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden bg-gradient-to-br from-brand-900 via-brand-800 to-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo dark />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">Tu reloj checador, en el celular de tu equipo.</h2>
          <ul className="mt-8 space-y-4 text-lg text-brand-100">
            {['Sin comprar relojes ni instalar apps', 'QR dinámico y PIN compartido', 'Retardos y horas trabajadas al instante', 'Prueba gratis, sin tarjeta'].map((t) => (
              <li key={t} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-mint-400" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-200/70">Tus datos viajan cifrados y cada negocio está completamente aislado de los demás.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-600">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export const AuthLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-semibold text-brand-700 hover:underline">{children}</Link>
);
