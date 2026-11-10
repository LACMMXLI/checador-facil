import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, BarChart3, CalendarClock, Check, ChevronDown, Clock, QrCode, ShieldCheck, Smartphone, Sparkles, Store, Tablet, UserPlus, Wallet, Wifi,
} from 'lucide-react';
import { buttonVariants, cn } from '@/components/ui/styles';
import { DemoQr, MockDashboard, ProductShowcase } from '@/components/marketing/showcase';
import { getPublicPlans } from '@/lib/public';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: `${process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil'} — Reloj checador en tu celular para tu negocio` },
  alternates: { canonical: '/' },
};

const BENEFITS = [
  { icon: Wallet, title: 'Sin comprar equipos', text: 'Olvídate de relojes checadores costosos y de su mantenimiento. Usas la tableta o el celular que ya tienes.' },
  { icon: Smartphone, title: 'Funciona en cualquier celular', text: 'Android, iPhone, tabletas y computadoras. Todo desde el navegador, sin instalar aplicaciones.' },
  { icon: QrCode, title: 'Registro con QR dinámico', text: 'Un código en pantalla que cambia cada 30 segundos. Tus empleados lo escanean con su celular.' },
  { icon: Clock, title: 'Control de retardos', text: 'Tolerancias configurables. Ves al instante quién llegó tarde y cuántos minutos.' },
  { icon: CalendarClock, title: 'Horarios y turnos', text: 'Define horarios por día, descansos y hasta turnos nocturnos que cruzan la medianoche.' },
  { icon: BarChart3, title: 'Reportes de asistencia', text: 'Horas trabajadas por día, semana, quincena o mes, con exportación a Excel.' },
  { icon: ShieldCheck, title: 'Correcciones con registro', text: 'Si alguien olvida checar, corriges con un motivo y queda constancia de quién y cuándo.' },
  { icon: Store, title: 'Varias sucursales', text: 'Administra cada local por separado desde una sola cuenta (según tu plan).' },
];

const STEPS = [
  { icon: UserPlus, title: 'Registra tu negocio', text: 'Crea tu cuenta en un minuto. Sin tarjeta para empezar tu prueba gratis.' },
  { icon: Store, title: 'Agrega a tus empleados', text: 'Nombre, sucursal y horario. Cada quien recibe su PIN y, si quieres, su acceso personal.' },
  { icon: Tablet, title: 'Activa tu checador QR', text: 'Abre el enlace en una tableta, ingresa el código temporal y déjala en el local.' },
  { icon: QrCode, title: 'Comienza a registrar asistencias', text: 'Tu equipo escanea el QR o usa el PIN compartido. Entrada y salida se alternan solas.' },
  { icon: BarChart3, title: 'Consulta todo desde tu celular', text: 'Quién está trabajando, retardos, horas y reportes, estés donde estés.' },
];

const FAQ = [
  { q: '¿Necesito comprar un reloj checador?', a: 'No. Usas una tableta, un celular viejo o una computadora que ya tengas, con el navegador abierto en la pantalla del checador.' },
  { q: '¿Funciona en iPhone y Android?', a: 'Sí. Funciona en los navegadores modernos de iPhone, Android, tabletas y computadoras. Para escanear el QR se necesita permitir el uso de la cámara.' },
  { q: '¿Necesito instalar una aplicación?', a: 'No. Todo funciona desde el navegador. Si quieres, puedes agregar un acceso directo en la pantalla de inicio de tu celular, pero no es obligatorio.' },
  { q: '¿Puedo usar una tableta?', a: 'Sí, es lo más recomendado: una tableta fija en el local mostrando el QR o el teclado de PIN. Se vincula con un código temporal y puedes revocarla cuando quieras.' },
  { q: '¿Qué pasa si un empleado no tiene celular?', a: 'Puede checar con su PIN de 6 dígitos en el dispositivo compartido del local. Tú decides si tu sucursal usa sólo QR, sólo PIN o ambos.' },
  { q: '¿Cómo funcionan los códigos QR?', a: 'La pantalla del local muestra un código que cambia cada 30 segundos. El empleado inicia sesión en su celular, escanea el código y el sistema valida todo en el servidor. Ayuda a evitar checadas desde otro lugar, pero no es infalible: una foto del código puede compartirse mientras siga vigente.' },
  { q: '¿Puedo cancelar mi suscripción?', a: 'Sí. No hay plazo forzoso. Si no renuevas, tu cuenta se suspende pero no borramos tus datos: podrás consultarlos y exportarlos.' },
  { q: '¿Puedo consultar asistencias anteriores?', a: 'Sí. El historial queda guardado y puedes filtrar por día, semana, quincena, mes o un rango personalizado, y exportarlo a Excel.' },
];

async function Pricing() {
  const plans = await getPublicPlans();
  if (!plans?.length) {
    return <p className="mx-auto mt-10 max-w-md text-center text-ink-500">En este momento no podemos mostrar los precios. <Link href="/registro" className="font-semibold text-brand-700 underline">Crea tu cuenta</Link> para verlos.</p>;
  }
  return (
    <div className={cn('mx-auto mt-12 grid max-w-4xl gap-6', plans.length > 1 && 'md:grid-cols-2')}>
      {plans.map((p) => (
        <div key={p.code} className={cn('relative flex flex-col rounded-3xl p-7 sm:p-8', p.highlighted ? 'bg-ink-900 text-white shadow-2xl ring-2 ring-brand-500' : 'bg-white shadow-soft ring-1 ring-ink-100')}>
          {p.highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-3 py-1 text-xs font-bold text-white">Más popular</span>}
          <h3 className="font-display text-xl font-extrabold">{p.name}</h3>
          <p className={cn('mt-1 text-sm', p.highlighted ? 'text-ink-300' : 'text-ink-500')}>{p.description}</p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-extrabold tracking-tight">{money(p.priceMonthlyCents, p.currency)}</span>
            <span className={cn('text-sm', p.highlighted ? 'text-ink-300' : 'text-ink-500')}>{p.currency} / mes</span>
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px]"><Check className={cn('mt-0.5 h-5 w-5 shrink-0', p.highlighted ? 'text-mint-400' : 'text-mint-600')} />{f}</li>
            ))}
          </ul>
          <Link href={`/registro?plan=${p.code}`} className={cn(buttonVariants({ variant: p.highlighted ? 'primary' : 'dark', size: 'lg' }), 'mt-8 w-full')}>Comenzar</Link>
          {p.trialDays > 0 && <p className={cn('mt-3 text-center text-xs', p.highlighted ? 'text-ink-400' : 'text-ink-500')}>{p.trialDays} días de prueba gratis · sin tarjeta</p>}
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  const plans = await getPublicPlans();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication', name: process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        description: 'Reloj checador por internet con QR dinámico y PIN para negocios.',
        offers: (plans ?? []).map((p) => ({ '@type': 'Offer', name: p.name, price: (p.priceMonthlyCents / 100).toFixed(2), priceCurrency: p.currency })),
      },
      { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-200/50 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-32 top-40 h-[26rem] w-[26rem] rounded-full bg-fuchsia-200/40 blur-3xl" aria-hidden />
        <div className="container-x relative grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-700 shadow-soft ring-1 ring-brand-100">
              <Sparkles className="h-4 w-4" /> Reloj checador en la nube · sin instalar nada
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Controla la asistencia de tu equipo <span className="gradient-text">desde cualquier lugar.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600 sm:text-xl">
              Olvídate de los relojes checadores costosos. Tus empleados registran sus entradas y salidas desde su celular, mientras tú controlas todo en tiempo real.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/registro" className={cn(buttonVariants({ size: 'lg' }), 'text-lg')}>Comenzar prueba gratis <ArrowRight className="h-5 w-5" /></Link>
              <Link href="#como-funciona" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-lg')}>Ver cómo funciona</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-600">
              {['Sin tarjeta para empezar', 'Android, iPhone y tabletas', 'Sin apps que instalar'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-mint-600" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto flex max-w-[430px] items-center justify-center">
              <div className="animate-float rounded-[2rem] border-[8px] border-ink-900 bg-gradient-to-b from-brand-950 to-ink-950 p-5 text-center text-white shadow-2xl">
                <p className="text-xs font-semibold text-brand-200">Tu negocio · Sucursal Centro</p>
                <div className="my-4 flex justify-center"><DemoQr size={190} /></div>
                <p className="font-display font-bold">Escanea para registrar tu asistencia</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-mint-400"><Wifi className="h-3.5 w-3.5" /> El código cambia cada 30 s</p>
              </div>
              <div className="absolute -bottom-10 -left-4 hidden scale-[.78] sm:block md:-left-24 lg:-left-32"><MockDashboard /></div>
            </div>
            <p className="mt-14 text-center text-xs text-ink-400 sm:mt-16">Ilustración del producto con datos de ejemplo.</p>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="scroll-mt-20 py-20">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-600">Hecho para negocios como el tuyo</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Todo lo que necesitas, nada de lo que no</h2>
            <p className="mt-4 text-lg text-ink-600">Un reloj checador simple, que se entiende en minutos y se paga mes a mes.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="group rounded-2xl border border-ink-100 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white"><b.icon className="h-6 w-6" /></span>
                <h3 className="mt-4 font-display text-lg font-bold">{b.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-20 bg-ink-950 py-20 text-white">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-300">Cómo funciona</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Listo para checar en cinco pasos</h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <span className="font-display text-5xl font-extrabold text-white/10">{i + 1}</span>
                <span className="mt-2 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500"><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center"><Link href="/registro" className={cn(buttonVariants({ variant: 'light', size: 'lg' }))}>Crear mi cuenta gratis <ArrowRight className="h-5 w-5" /></Link></div>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="scroll-mt-20 py-20">
        <div className="container-x">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="font-semibold text-brand-600">El producto</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Así se ve en el día a día</h2>
          </div>
          <ProductShowcase />
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="scroll-mt-20 bg-gradient-to-b from-white to-brand-50 py-20">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-600">Planes y precios</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Una mensualidad simple, sin sorpresas</h2>
            <p className="mt-4 text-lg text-ink-600">Empieza con prueba gratis. Sin tarjeta, sin plazo forzoso.</p>
          </div>
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="scroll-mt-20 py-20">
        <div className="container-x max-w-3xl">
          <h2 className="text-center font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
          <div className="mt-10 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-soft">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-lg font-bold">
                  {f.q}<ChevronDown className="h-5 w-5 shrink-0 text-ink-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-ink-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-4 pb-20">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-fuchsia-600 px-6 py-14 text-center text-white shadow-glow sm:px-12">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Deja de perseguir hojas de asistencia</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">Crea tu cuenta, agrega a tu equipo y registra tu primera checada hoy mismo.</p>
            <Link href="/registro" className={cn(buttonVariants({ variant: 'light', size: 'lg' }), 'mt-8')}>Comenzar prueba gratis <ArrowRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
