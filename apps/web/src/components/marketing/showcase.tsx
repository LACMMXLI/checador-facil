'use client';
import { useState } from 'react';
import { BarChart3, QrCode as QrIcon, Smartphone, Users } from 'lucide-react';
import { cn } from '@/components/ui/styles';
import { SHOTS, type Shot } from './shots';

/** Marco de navegador para capturas de escritorio/tableta. */
export function BrowserShot({ shot, className, eager, label }: { shot: Shot; className?: string; eager?: boolean; label?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-ink-900 shadow-2xl ring-1 ring-white/15', className)}>
      <div className="flex items-center gap-1.5 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        {label && <span className="ml-3 truncate rounded-md bg-white/10 px-3 py-0.5 text-[11px] font-medium text-ink-300">{label}</span>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-auto w-full" />
    </div>
  );
}

/** Marco de celular para capturas móviles. */
export function PhoneShot({ shot, className, eager }: { shot: Shot; className?: string; eager?: boolean }) {
  return (
    <div className={cn('overflow-hidden rounded-[2rem] border-[7px] border-ink-900 bg-ink-900 shadow-2xl ring-1 ring-white/15', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-auto w-full rounded-[1.5rem]" />
    </div>
  );
}

const TABS = [
  { id: 'panel', label: 'Panel del dueño', icon: Users, color: 'from-brand-500 to-fuchsia-500', title: 'Mira quién está trabajando, en tiempo real', text: 'Quién llegó, quién va tarde y quién no ha checado. Lo ves en cuanto pasa, sin hojas de cálculo ni llamadas.', points: ['Contadores del día en un vistazo', 'Aviso de jornadas sin salida', 'Retardos con los minutos exactos'], kind: 'browser' as const, shot: SHOTS.panel, bar: 'Panel · Inicio' },
  { id: 'qr', label: 'Checador QR y PIN', icon: QrIcon, color: 'from-fuchsia-500 to-amber-400', title: 'Tu tableta se convierte en reloj checador', text: 'Déjala en el local con el QR en pantalla. El código cambia cada 30 segundos y quien no trae celular checa con su PIN.', points: ['QR dinámico que cambia solo', 'Teclado de PIN compartido', 'Hora oficial del servidor'], kind: 'browser' as const, shot: SHOTS.kiosko, bar: 'Checador · Sucursal Centro' },
  { id: 'rep', label: 'Reportes', icon: BarChart3, color: 'from-emerald-400 to-cyan-500', title: 'Horas, retardos y exportación a Excel', text: 'Consulta por día, semana, quincena o mes. Corrige con motivo y bitácora, y descarga tu reporte cuando lo necesites.', points: ['Total de jornadas y horas', 'Correcciones con respaldo', 'Exportación a Excel (CSV)'], kind: 'browser' as const, shot: SHOTS.reportes, bar: 'Panel · Asistencias' },
  { id: 'cel', label: 'Desde tu celular', icon: Smartphone, color: 'from-cyan-400 to-brand-500', title: 'Todo tu negocio en la palma de tu mano', text: 'El mismo panel, adaptado a tu celular. Sin instalar aplicaciones: abres el navegador y listo.', points: ['Android y iPhone', 'Sin instalar nada', 'Estés donde estés'], kind: 'phone' as const, shot: SHOTS.movil, bar: '' },
];

export function ProductShowcase() {
  const [id, setId] = useState('panel');
  const tab = TABS.find((t) => t.id === id)!;
  return (
    <div>
      <div role="tablist" aria-label="Pantallas del sistema" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === id} onClick={() => setId(t.id)}
            className={cn('flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition duration-300', t.id === id ? cn('bg-gradient-to-r text-white shadow-glow', t.color) : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:-translate-y-0.5 hover:bg-ink-50')}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]" role="tabpanel">
        <div className="order-2 lg:order-1" key={`t-${id}`}>
          <div className="animate-fade-up">
            <h3 className="font-display text-2xl font-extrabold sm:text-3xl">{tab.title}</h3>
            <p className="mt-3 text-lg leading-relaxed text-ink-600">{tab.text}</p>
            <ul className="mt-5 space-y-2.5">
              {tab.points.map((p) => (
                <li key={p} className="flex items-center gap-3 font-semibold text-ink-800"><span className={cn('h-2.5 w-2.5 rounded-full bg-gradient-to-r', tab.color)} />{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative order-1 lg:order-2" key={id}>
          <div className={cn('pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br opacity-25 blur-3xl', tab.color)} aria-hidden />
          <div className="animate-fade-up">
            {tab.kind === 'browser' ? <BrowserShot shot={tab.shot} label={tab.bar} /> : <PhoneShot shot={tab.shot} className="mx-auto w-[270px]" />}
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-ink-500">Capturas reales del sistema, tomadas en una cuenta de demostración con datos ficticios.</p>
    </div>
  );
}
