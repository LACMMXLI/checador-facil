'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { buttonVariants, cn } from '@/components/ui/styles';
import { formatHistory, money } from '@/lib/format';
import type { PublicPlan } from '@/lib/public';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Line { ok: boolean; text: string }

/** Líneas de la tarjeta: lo que SÍ incluye primero (resumido) y lo que NO incluye al final, todo derivado de los datos reales del plan. */
function cardLines(p: PublicPlan): Line[] {
  const yes: Line[] = [
    { ok: true, text: `Hasta ${p.maxEmployees} empleados` },
    { ok: true, text: plural(p.maxBranches, 'sucursal', 'sucursales') },
  ];
  if (p.canSchedules) yes.push({ ok: true, text: 'Horarios por día y turnos nocturnos' });
  if (p.canLateControl) yes.push({ ok: true, text: 'Control de retardos y tolerancias' });
  yes.push({ ok: true, text: `Reportes ${p.historyDays >= 60 ? 'de hasta' : 'de los últimos'} ${formatHistory(p.historyDays)}` });
  if (p.canExport) yes.push({ ok: true, text: 'Exportación a Excel' });
  for (const f of p.features) yes.push({ ok: true, text: f });
  const no: Line[] = [];
  if (!p.canSchedules) no.push({ ok: false, text: 'Sin horarios ni turnos nocturnos' });
  if (!p.canLateControl) no.push({ ok: false, text: 'Sin control de retardos' });
  if (!p.canExport) no.push({ ok: false, text: 'Sin exportación a Excel' });
  return [...yes, ...no];
}

type Cell = string | boolean;
interface Row { label: string; hint?: string; value: (p: PublicPlan) => Cell }
interface Group { title: string; rows: Row[] }

const GROUPS: Group[] = [
  { title: 'Capacidad', rows: [
    { label: 'Empleados activos', value: (p) => `Hasta ${p.maxEmployees}` },
    { label: 'Sucursales', hint: 'Cada una con sus checadores y su zona horaria', value: (p) => String(p.maxBranches) },
  ] },
  { title: 'Checada', rows: [
    { label: 'QR dinámico que cambia cada 30 s', value: () => true },
    { label: 'PIN compartido en tableta o celular', value: () => true },
    { label: 'Portal del empleado con su propio celular', value: () => true },
    { label: 'Modo con confirmación al escanear', value: () => true },
    { label: 'Vincular y revocar checadores', value: () => true },
  ] },
  { title: 'Horarios y retardos', rows: [
    { label: 'Horarios por día y descansos', value: (p) => p.canSchedules },
    { label: 'Turnos nocturnos', hint: 'Que cruzan la medianoche, como 22:00 a 06:00', value: (p) => p.canSchedules },
    { label: 'Tolerancia de entrada y salida', value: (p) => p.canLateControl },
    { label: 'Retardos y salidas anticipadas', hint: 'Por empleado, con los minutos exactos', value: (p) => p.canLateControl },
  ] },
  { title: 'Reportes', rows: [
    { label: 'Entradas, salidas y horas trabajadas', value: () => true },
    { label: 'Historial de reportes', hint: 'Tus registros se guardan siempre; el plan define cuánto puedes consultar', value: (p) => formatHistory(p.historyDays) },
    { label: 'Filtros por día, semana, quincena, mes o rango', value: () => true },
    { label: 'Exportación a Excel (CSV)', value: (p) => p.canExport },
  ] },
  { title: 'Control y administración', rows: [
    { label: 'Correcciones con bitácora', hint: 'Queda guardado quién cambió qué, cuándo y por qué', value: () => true },
    { label: 'Registro manual de jornadas olvidadas', value: () => true },
    { label: 'Aviso de jornadas incompletas', value: () => true },
    { label: 'Varias sucursales en un solo panel', value: (p) => p.maxBranches > 1 },
  ] },
];

function CellView({ v, hl }: { v: Cell; hl: boolean }) {
  if (v === true) return <Check className={cn('mx-auto h-5 w-5', hl ? 'text-brand-600' : 'text-mint-600')} aria-label="Incluido" />;
  if (v === false) return <Minus className="mx-auto h-5 w-5 text-ink-300" aria-label="No incluido" />;
  return <span className="font-semibold">{v}</span>;
}

const VISIBLE = 6;

export function PricingSection({ plans }: { plans: PublicPlan[] | null }) {
  const [more, setMore] = useState(false);
  if (!plans?.length) {
    return <p className="mx-auto mt-10 max-w-md text-center text-ink-500">En este momento no podemos mostrar los precios. <Link href="/registro" className="font-semibold text-brand-700 underline">Crea tu cuenta</Link> para verlos.</p>;
  }
  const cheapest = plans.reduce((a, b) => (b.priceMonthlyCents < a.priceMonthlyCents ? b : a));

  return (
    <>
      <div className={cn('mx-auto mt-14 grid max-w-4xl items-stretch gap-6', plans.length > 1 && 'md:grid-cols-2')}>
        {plans.map((p) => {
          const hl = p.highlighted;
          const diff = p.priceMonthlyCents - cheapest.priceMonthlyCents;
          const ratio = Math.round(p.maxEmployees / cheapest.maxEmployees);
          const lines = cardLines(p);
          const shown = more ? lines : lines.slice(0, VISIBLE);
          const hidden = lines.length - shown.length;
          return (
            <div key={p.code} className={cn('relative flex flex-col rounded-3xl p-7 sm:p-8', hl
              ? 'bg-ink-900 text-white shadow-2xl ring-2 ring-brand-500 md:-my-4 md:py-11'
              : 'bg-white/70 text-ink-700 shadow-soft ring-1 ring-ink-100')}>
              {hl && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-glow">Recomendado</span>}
              <h3 className="font-display text-xl font-extrabold">{p.name}</h3>
              <p className={cn('mt-1 text-sm', hl ? 'text-ink-300' : 'text-ink-500')}>{p.description}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className={cn('font-display font-extrabold tracking-tight', hl ? 'text-6xl' : 'text-5xl')}>{money(p.priceMonthlyCents, p.currency)}</span>
                <span className={cn('text-sm', hl ? 'text-ink-300' : 'text-ink-500')}>{p.currency} / mes</span>
              </p>
              {hl && diff > 0 && (
                <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-mint-400">
                  Solo {money(diff, p.currency)} más al mes{ratio >= 2 ? ` y tienes ${ratio} veces más empleados` : ''}, horarios, retardos, varias sucursales y Excel.
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-2.5">
                {shown.map((l) => (
                  <li key={l.text} className={cn('flex items-start gap-2.5 text-[15px]', !l.ok && 'opacity-60')}>
                    {l.ok ? <Check className={cn('mt-0.5 h-5 w-5 shrink-0', hl ? 'text-mint-400' : 'text-mint-600')} /> : <Minus className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />}
                    <span className={cn(!l.ok && 'line-through decoration-ink-300')}>{l.text}</span>
                  </li>
                ))}
              </ul>
              {hidden > 0 && (
                <button type="button" onClick={() => setMore(true)} className={cn('mt-3 text-left text-sm font-semibold underline-offset-2 hover:underline', hl ? 'text-brand-200' : 'text-brand-700')}>
                  {lines.slice(VISIBLE).some((l) => l.ok)
                    ? `+ ${lines.slice(VISIBLE).filter((l) => l.ok).length} beneficio${lines.slice(VISIBLE).filter((l) => l.ok).length > 1 ? 's' : ''} más`
                    : 'Ver lo que no incluye'}
                </button>
              )}
              <Link href={`/registro?plan=${p.code}`} className={cn(buttonVariants({ variant: hl ? 'primary' : 'outline', size: 'lg' }), 'mt-7 w-full', hl && 'text-lg')}>
                {hl ? `Probar ${p.name} gratis` : `Probar ${p.name}`}
              </Link>
              {p.trialDays > 0 && <p className={cn('mt-3 text-center text-xs', hl ? 'text-ink-400' : 'text-ink-500')}>{p.trialDays} días de prueba gratis · sin tarjeta</p>}
            </div>
          );
        })}
      </div>

      {plans.length > 1 && (
        <div className="mx-auto mt-12 max-w-4xl">
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-controls="tabla-beneficios"
            className="mx-auto flex items-center gap-2 rounded-full bg-white px-6 py-3 font-display text-base font-bold text-brand-700 shadow-soft ring-1 ring-brand-200 transition hover:bg-brand-50">
            {more ? 'Ocultar la comparación' : 'Ver todos los beneficios y comparar planes'}
            <ChevronDown className={cn('h-5 w-5 transition', more && 'rotate-180')} />
          </button>

          {more && (
            <div id="tabla-beneficios" className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 animate-fade-up">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <caption className="sr-only">Comparación detallada de planes</caption>
                <thead>
                  <tr className="border-b border-ink-100">
                    <th scope="col" className="px-5 py-4 font-display text-base font-bold">Beneficios</th>
                    {plans.map((p) => (
                      <th key={p.code} scope="col" className={cn('px-5 py-4 text-center font-display text-base font-extrabold', p.highlighted && 'bg-brand-50 text-brand-700')}>
                        {p.name}<span className="block text-sm font-semibold text-ink-500">{money(p.priceMonthlyCents, p.currency)}/mes</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {GROUPS.map((g) => (
                  <tbody key={g.title} className="divide-y divide-ink-100">
                    <tr><th colSpan={plans.length + 1} scope="colgroup" className="bg-ink-50 px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-ink-500">{g.title}</th></tr>
                    {g.rows.map((r) => (
                      <tr key={r.label}>
                        <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink-800">
                          {r.label}{r.hint && <span className="block text-xs font-normal text-ink-500">{r.hint}</span>}
                        </th>
                        {plans.map((p) => (
                          <td key={p.code} className={cn('px-5 py-3.5 text-center', p.highlighted && 'bg-brand-50/60')}><CellView v={r.value(p)} hl={p.highlighted} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
