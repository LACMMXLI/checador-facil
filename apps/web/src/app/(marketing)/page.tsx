import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, BarChart3, CalendarClock, Check, CheckCircle2, ChevronDown, Clock, Coffee, FileCheck2, Gavel, QrCode, Quote, Scissors, ShieldCheck, ShoppingBag,
  Smartphone, Sparkles, Stethoscope, Store, Tablet, UserPlus, UtensilsCrossed, Wallet, Wrench,
} from 'lucide-react';
import { buttonVariants, cn } from '@/components/ui/styles';
import { BrowserShot, PhoneShot, ProductShowcase } from '@/components/marketing/showcase';
import { SHOTS } from '@/components/marketing/shots';
import { PricingSection } from '@/components/marketing/pricing';
import { CountUp, Reveal } from '@/components/marketing/motion';
import { formatHistory, money } from '@/lib/format';
import { getPublicPlans } from '@/lib/public';
import { BUSINESS_COUNT, TESTIMONIALS } from '@/lib/testimonials';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: `${process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil'} — Reloj checador en tu celular para tu negocio` },
  alternates: { canonical: '/' },
};

const BENEFITS = [
  { icon: Wallet, color: 'from-emerald-400 to-teal-500', title: 'Ahorra en equipo', text: 'Usa la tableta o el celular que ya tienes. Cero relojes costosos y cero mantenimiento.' },
  { icon: Smartphone, color: 'from-brand-500 to-fuchsia-500', title: 'Funciona en cualquier celular', text: 'Android, iPhone, tabletas y computadoras. Todo desde el navegador, sin instalar aplicaciones.' },
  { icon: QrCode, color: 'from-fuchsia-500 to-pink-500', title: 'Un QR que cambia solo', text: 'El código en pantalla cambia cada 30 segundos. Tu equipo lo escanea con su celular y listo.' },
  { icon: Clock, color: 'from-amber-400 to-orange-500', title: 'Retardos al instante', text: 'Con el plan Avanzado defines tu tolerancia y ves quién llegó tarde y cuántos minutos, sin revisar listas.' },
  { icon: CalendarClock, color: 'from-cyan-400 to-blue-500', title: 'Horarios y turnos', text: 'Con el plan Avanzado: horarios por día, descansos y turnos nocturnos que cruzan la medianoche.' },
  { icon: BarChart3, color: 'from-violet-500 to-brand-600', title: 'Horas trabajadas, claras', text: 'Cada jornada con su entrada, salida y horas, por día, semana, quincena o mes.' },
  { icon: ShieldCheck, color: 'from-teal-400 to-emerald-600', title: 'Correcciones con respaldo', text: 'Si alguien olvida checar, lo corriges con un motivo y queda registro de quién cambió qué.' },
  { icon: Store, color: 'from-pink-500 to-rose-500', title: 'Todos tus locales en un panel', text: 'Con el plan Avanzado administras varias sucursales desde la misma cuenta.' },
];

const STEPS = [
  { icon: UserPlus, title: 'Registra tu negocio', text: 'Crea tu cuenta en un minuto. Sin tarjeta para empezar tu prueba gratis.' },
  { icon: Store, title: 'Agrega a tus empleados', text: 'Nombre y sucursal (y su horario, con el plan Avanzado). Cada quien recibe su PIN y, si quieres, su acceso personal.' },
  { icon: Tablet, title: 'Activa tu checador QR', text: 'Abre el enlace en una tableta, ingresa el código temporal y déjala en el local.' },
  { icon: QrCode, title: 'Tu equipo empieza a checar', text: 'Escanean el QR o usan el PIN compartido. Entrada y salida se alternan solas.' },
  { icon: BarChart3, title: 'Tú lo ves todo en vivo', text: 'Quién está trabajando, quién llegó tarde y las horas de cada quien, estés donde estés.' },
];

const BUSINESSES = [
  { icon: UtensilsCrossed, name: 'Restaurantes y taquerías', text: 'Turnos partidos, meseros y cocina en un solo reporte.' },
  { icon: Coffee, name: 'Cafeterías', text: 'Una tableta en la barra y todo tu equipo checa en segundos.' },
  { icon: ShoppingBag, name: 'Tiendas y abarrotes', text: 'Sabes a qué hora abrió cada local sin estar ahí.' },
  { icon: Wrench, name: 'Talleres', text: 'Checada con PIN para quien no trae celular a la mano.' },
  { icon: Scissors, name: 'Estéticas y barberías', text: 'Horas trabajadas claras para pagar sin discusiones.' },
  { icon: Stethoscope, name: 'Consultorios y farmacias', text: 'Entradas y salidas ordenadas, listas cuando las pidan.' },
];
const MARQUEE = ['Restaurantes', 'Cafeterías', 'Taquerías', 'Tiendas de abarrotes', 'Talleres mecánicos', 'Estéticas', 'Barberías', 'Farmacias', 'Consultorios', 'Papelerías', 'Panaderías', 'Gimnasios', 'Lavanderías', 'Ferreterías'];

const LAW_POINTS = [
  'Hora de entrada y salida de cada persona, con la hora del servidor',
  'Horas trabajadas calculadas automáticamente por jornada',
  'Historial consultable por empleado, día, semana, quincena o mes',
  'Correcciones con bitácora: quién cambió qué, cuándo y por qué',
  'Exportación a Excel para entregar o respaldar (plan Avanzado)',
];

/** Días que faltan para el 1 de enero de 2027 (hora del centro de México). */
function daysToMandate() {
  const ms = Date.UTC(2027, 0, 1, 6) - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function SectionHead({ kicker, title, text, dark }: { kicker: string; title: React.ReactNode; text?: string; dark?: boolean }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className={cn('inline-block rounded-full px-4 py-1.5 text-sm font-bold', dark ? 'bg-white/10 text-brand-200 ring-1 ring-white/15' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100')}>{kicker}</p>
      <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">{title}</h2>
      {text && <p className={cn('mt-4 text-lg', dark ? 'text-ink-300' : 'text-ink-600')}>{text}</p>}
    </Reveal>
  );
}

export default async function Home() {
  const plans = await getPublicPlans();
  const trial = plans?.length ? Math.max(...plans.map((p) => p.trialDays)) : 7;
  const basic = plans?.[0]; const top = plans && plans.length > 1 ? plans[plans.length - 1] : null;
  const cheapest = plans?.length ? plans.reduce((a, b) => (b.priceMonthlyCents < a.priceMonthlyCents ? b : a)) : null;
  const days = daysToMandate();

  const FAQ = [
    { q: '¿Necesito comprar un reloj checador?', a: 'No. Usas una tableta, un celular viejo o una computadora que ya tengas, con el navegador abierto en la pantalla del checador.' },
    { q: '¿Me sirve para el registro electrónico de jornada que pide la ley?', a: 'El sistema guarda de forma electrónica la hora de entrada y de salida de cada persona, calcula sus horas y conserva el historial con bitácora de correcciones, que es lo que pide la reforma a la Ley Federal del Trabajo publicada el 1 de mayo de 2026. Los detalles finos del registro los define la Secretaría del Trabajo en disposiciones generales: revisa con tu contador o abogado los requisitos que apliquen a tu negocio.' },
    { q: '¿Funciona en iPhone y Android?', a: 'Sí. Funciona en los navegadores modernos de iPhone, Android, tabletas y computadoras. Para escanear el QR se necesita permitir el uso de la cámara.' },
    { q: '¿Necesito instalar una aplicación?', a: 'No. Todo funciona desde el navegador. Si quieres, puedes agregar un acceso directo en la pantalla de inicio de tu celular, pero no es obligatorio.' },
    { q: '¿Puedo usar una tableta?', a: 'Sí, es lo más recomendado: una tableta fija en el local mostrando el QR o el teclado de PIN. Se vincula con un código temporal y puedes revocarla cuando quieras.' },
    { q: '¿Qué pasa si un empleado no tiene celular?', a: 'Puede checar con su PIN de 6 dígitos en el dispositivo compartido del local. Tú decides si tu sucursal usa sólo QR, sólo PIN o ambos.' },
    { q: '¿Cómo funcionan los códigos QR?', a: 'La pantalla del local muestra un código que cambia cada 30 segundos. El empleado inicia sesión en su celular, escanea el código y el sistema valida todo en el servidor. Ayuda a evitar checadas desde otro lugar, pero no es infalible: una foto del código puede compartirse mientras siga vigente.' },
    { q: `¿Qué incluye la prueba gratis de ${trial} días?`, a: `Usas el plan que elijas con todas sus funciones durante ${trial} días, sin dar tarjeta. Si no continúas, tu cuenta se pausa y no borramos tus datos.` },
    { q: '¿Cuál plan me conviene?', a: basic && top ? `Si tienes un solo local y hasta ${basic.maxEmployees} empleados, el ${basic.name} es suficiente. Si necesitas horarios y turnos nocturnos, control de retardos, un equipo más grande, varias sucursales, ${formatHistory(top.historyDays)} de historial o exportar a Excel, elige el ${top.name}.` : 'Elige según el número de empleados y sucursales que tengas.' },
    { q: '¿Puedo cambiar de plan después?', a: 'Sí. Escríbenos y lo cambiamos. Si subes de plan recuperas al instante el historial y la exportación, porque tus datos nunca se borran.' },
    { q: '¿Puedo cancelar mi suscripción?', a: 'Sí. No hay plazo forzoso. Si no renuevas, tu cuenta se suspende pero no borramos tus datos: podrás consultarlos y exportarlos.' },
    { q: '¿Puedo consultar asistencias anteriores?', a: basic && top ? `Sí. Se guardan todas. Con el plan ${basic.name} consultas los últimos ${formatHistory(basic.historyDays)} y con el ${top.name} hasta ${formatHistory(top.historyDays)}, por día, semana, quincena, mes o un rango.` : 'Sí. El historial se conserva y puedes filtrarlo por día, semana, quincena, mes o un rango.' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication', name: process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        description: 'Reloj checador por internet con QR dinámico y PIN para negocios. Registro electrónico de entradas, salidas y horas trabajadas.',
        offers: (plans ?? []).map((p) => ({ '@type': 'Offer', name: p.name, price: (p.priceMonthlyCents / 100).toFixed(2), priceCurrency: p.currency })),
      },
      { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <noscript><style>{'.reveal{opacity:1!important;transform:none!important}'}</style></noscript>

      {/* HERO */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(108,83,244,.55),transparent_70%)]" aria-hidden />
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -right-24 top-10 h-[30rem] w-[30rem] animate-blob rounded-full bg-fuchsia-500/30 blur-[100px]" aria-hidden />
        <div className="pointer-events-none absolute -left-32 top-52 h-[26rem] w-[26rem] animate-blob rounded-full bg-brand-500/40 blur-[100px] [animation-delay:-6s]" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 animate-blob rounded-full bg-amber-400/15 blur-[90px] [animation-delay:-11s]" aria-hidden />

        <div className="container-x relative grid grid-cols-1 items-center gap-14 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-14">
          <div className="min-w-0 animate-fade-up">
            <Link href="#reforma" className="group inline-flex max-w-full items-center gap-2 rounded-full bg-amber-300/15 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-amber-200 ring-1 ring-amber-300/40 transition hover:bg-amber-300/25">
              <span className="shrink-0 rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-extrabold uppercase text-ink-900">Ley 2027</span>
              <span className="truncate">El registro electrónico de jornada ya es obligación</span>
              <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" />
            </Link>
            <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[3.5rem] xl:text-[3.9rem]">
              El reloj checador que ya traes <span className="text-shine">en tu celular.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-200">
              Tus empleados checan entrada y salida con un QR desde su celular. Tú ves en vivo quién llegó, quién va tarde y cuántas horas trabajó cada quien. Sin comprar relojes y sin instalar nada.
            </p>

            {cheapest && (
              <div className="mt-7 inline-flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20 backdrop-blur">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-200">Desde sólo</p>
                  <p className="font-display text-5xl font-extrabold leading-none tracking-tighter text-amber-300 sm:text-6xl">{money(cheapest.priceMonthlyCents, cheapest.currency)}</p>
                </div>
                <p className="text-sm font-semibold leading-snug text-ink-200">{cheapest.currency} al mes<br />por todo tu equipo<br /><span className="text-mint-400">{trial} días gratis</span></p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/registro" className={cn(buttonVariants({ size: 'lg' }), 'btn-shine h-16 bg-gradient-to-r from-brand-500 to-fuchsia-500 px-8 text-lg font-extrabold hover:scale-[1.03] hover:from-brand-500 hover:to-fuchsia-500')}>Probar gratis {trial} días <ArrowRight className="h-5 w-5" /></Link>
              <Link href="#precios" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-16 border-white/25 bg-white/5 text-lg text-white hover:bg-white/15')}>Ver precios</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-200">
              {['Sin tarjeta', 'Android, iPhone y tabletas', 'Empiezas hoy mismo'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-mint-400" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-xl lg:max-w-none">
            <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-brand-500/40 via-fuchsia-500/30 to-amber-300/20 blur-3xl" aria-hidden />
            <div className="relative animate-float-slow">
              <BrowserShot shot={SHOTS.panel} eager label="Panel · Inicio" />
            </div>
            <PhoneShot shot={SHOTS.movil} eager className="absolute -bottom-10 -left-3 w-[30%] min-w-[104px] animate-float sm:-left-8" />
            <div className="absolute -right-2 top-[16%] hidden animate-float items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-2xl [animation-delay:-2s] sm:flex lg:-right-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-mint-50"><CheckCircle2 className="h-5 w-5 text-mint-600" /></span>
              <span><span className="block text-sm font-extrabold">Entrada registrada</span><span className="block text-xs text-ink-500">Carla Ruiz · 08:57</span></span>
            </div>
            <div className="absolute -bottom-6 right-4 hidden animate-float items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-2xl [animation-delay:-4s] sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50"><Clock className="h-5 w-5 text-amber-600" /></span>
              <span><span className="block text-sm font-extrabold">Retardo · 12 min</span><span className="block text-xs text-ink-500">Bruno Martínez · 09:12</span></span>
            </div>
          </div>
        </div>

        {/* Giros de negocio */}
        <div className="relative border-t border-white/10 bg-white/[.03] py-5">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[.2em] text-ink-400">Hecho para negocios de México</p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className="flex w-max animate-marquee gap-3 pr-3">
              {[...MARQUEE, ...MARQUEE].map((m, i) => (
                <span key={i} aria-hidden={i >= MARQUEE.length} className="whitespace-nowrap rounded-full bg-white/5 px-5 py-2 text-sm font-semibold text-ink-200 ring-1 ring-white/10">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CIFRAS (hechos del producto, no estadísticas de clientes) */}
      <section className="relative z-10 -mt-px bg-gradient-to-r from-brand-600 via-fuchsia-600 to-brand-600 text-white">
        <div className="container-x grid grid-cols-2 gap-y-6 py-8 text-center lg:grid-cols-4">
          {[
            { v: <CountUp to={0} prefix="$" />, l: 'en relojes o equipo especial' },
            { v: <><CountUp to={30} /> s</>, l: 'tarda en cambiar el código QR' },
            { v: <><CountUp to={5} /> pasos</>, l: 'para empezar a checar hoy' },
            { v: <><CountUp to={trial} /> días</>, l: 'de prueba gratis, sin tarjeta' },
          ].map((s, i) => (
            <div key={i} className="px-3">
              <p className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{s.v}</p>
              <p className="mt-1 text-sm font-medium text-white/85">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* REFORMA LABORAL */}
      <section id="reforma" className="scroll-mt-20 bg-gradient-to-b from-amber-50 via-white to-white py-20">
        <div className="container-x">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_1fr]">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-1.5 text-sm font-extrabold text-ink-900 shadow-lg shadow-amber-300/40"><Gavel className="h-4 w-4" /> Reforma laboral · Ley Federal del Trabajo</p>
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
                Checar con libreta ya no alcanza: el <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">registro electrónico de jornada</span> es obligación.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-600">
                La reforma de la jornada de 40 horas, publicada en el Diario Oficial de la Federación el <strong className="text-ink-900">1 de mayo de 2026</strong>, agregó al artículo 132 de la Ley Federal del Trabajo la obligación de que todo patrón registre <strong className="text-ink-900">de manera electrónica</strong> la jornada de cada trabajador, con su hora de inicio y de fin. Conforme a lo publicado, se exige a partir del <strong className="text-ink-900">1 de enero de 2027</strong>.
              </p>

              <ol className="mt-8 space-y-0">
                {[
                  { d: '1 may 2026', t: 'Se publica la reforma en el DOF', s: 'Jornada de 40 horas y registro electrónico de jornada (art. 132, fracc. XXXIV).', done: true },
                  { d: '1 ene 2027', t: 'El registro electrónico se vuelve exigible', s: 'Entran las reglas de la Secretaría del Trabajo y las sanciones por no cumplir.', hot: true },
                  { d: '2027 – 2030', t: 'La jornada baja año con año hasta 40 horas', s: 'Vas a necesitar las horas reales de cada persona para ajustar turnos y horas extra.' },
                ].map((e, i, arr) => (
                  <li key={e.d} className="relative flex gap-4 pb-7 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute left-[11px] top-6 h-full w-0.5 bg-gradient-to-b from-amber-400 to-amber-100" aria-hidden />}
                    <span className={cn('relative mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-4', e.hot ? 'bg-orange-500 ring-orange-200' : e.done ? 'bg-amber-400 ring-amber-100' : 'bg-white ring-amber-200')}>
                      {e.hot && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-orange-500" />}
                      {e.done && <Check className="h-3.5 w-3.5 text-ink-900" />}
                    </span>
                    <div>
                      <p className={cn('text-sm font-extrabold uppercase tracking-wide', e.hot ? 'text-orange-600' : 'text-amber-700')}>{e.d}</p>
                      <p className="font-display text-lg font-bold">{e.t}</p>
                      <p className="text-[15px] text-ink-600">{e.s}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white shadow-2xl sm:p-9">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/25 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" aria-hidden />
                <div className="relative">
                  {days > 0 ? (
                    <div className="flex items-end gap-3">
                      <p className="font-display text-7xl font-extrabold leading-none tracking-tighter text-amber-300 sm:text-8xl"><CountUp to={days} /></p>
                      <p className="mb-2 text-lg font-bold leading-tight">días para el<br />1 de enero de 2027</p>
                    </div>
                  ) : (
                    <p className="font-display text-3xl font-extrabold text-amber-300">Ya es exigible desde el 1 de enero de 2027</p>
                  )}
                  <p className="mt-6 flex items-center gap-2 font-display text-xl font-extrabold"><FileCheck2 className="h-6 w-6 text-mint-400" /> Con {process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil'} ya lo tienes:</p>
                  <ul className="mt-4 space-y-3">
                    {LAW_POINTS.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-[15px] text-ink-100"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint-400" />{p}</li>
                    ))}
                  </ul>
                  <Link href="/registro" className={cn(buttonVariants({ size: 'lg' }), 'btn-shine mt-7 h-auto min-h-14 w-full whitespace-normal bg-amber-300 px-4 py-3 text-center text-base font-extrabold sm:text-lg text-ink-900 shadow-lg shadow-amber-300/30 hover:bg-amber-200')}>Empezar mi registro electrónico <ArrowRight className="h-5 w-5" /></Link>
                  <p className="mt-3 text-center text-xs text-ink-400">{trial} días gratis · sin tarjeta{cheapest ? ` · desde ${money(cheapest.priceMonthlyCents, cheapest.currency)} al mes` : ''}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Información general, no es asesoría legal. La Secretaría del Trabajo y Previsión Social define los detalles del registro en disposiciones de carácter general. Consulta el decreto en el Diario Oficial de la Federación y a tu contador o abogado para los requisitos de tu negocio.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="scroll-mt-20 py-20">
        <div className="container-x">
          <SectionHead kicker="Por qué te conviene" title={<>Controla a tu equipo <span className="gradient-text">sin perseguir a nadie</span></>} text="Sabes quién llegó, quién llegó tarde y cuántas horas trabajó cada persona, al instante y desde tu celular." />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={(i % 4) * 80}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:shadow-glow">
                  <div className={cn('pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition duration-500 group-hover:opacity-40', b.color)} aria-hidden />
                  <span className={cn('relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg transition duration-300 group-hover:scale-110 group-hover:-rotate-6', b.color)}><b.icon className="h-6 w-6" /></span>
                  <h3 className="relative mt-4 font-display text-lg font-bold">{b.title}</h3>
                  <p className="relative mt-2 text-[15px] leading-relaxed text-ink-600">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="relative scroll-mt-20 overflow-hidden bg-ink-950 py-20 text-white">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[110px]" aria-hidden />
        <div className="container-x relative">
          <SectionHead dark kicker="Cómo funciona" title={<>Empieza a checar hoy <span className="text-shine">en 5 pasos</span></>} />
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 90} className="h-full">
                  <div className="group relative h-full rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1.5 hover:bg-white/10 hover:ring-brand-400/60">
                    <span className="absolute right-4 top-2 font-display text-6xl font-extrabold text-white/10 transition group-hover:text-white/25">{i + 1}</span>
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-glow"><s.icon className="h-6 w-6" /></span>
                    <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center"><Link href="/registro" className={cn(buttonVariants({ variant: 'light', size: 'lg' }), 'btn-shine')}>Crear mi cuenta gratis <ArrowRight className="h-5 w-5" /></Link></div>
        </div>
      </section>

      {/* PRODUCTO: CAPTURAS REALES */}
      <section id="demo" className="scroll-mt-20 py-20">
        <div className="container-x">
          <div className="mb-10"><SectionHead kicker="El sistema, tal cual es" title={<>Así se ve <span className="gradient-text">por dentro</span></>} text="Nada de maquetas: estas son pantallas reales del sistema funcionando." /></div>
          <Reveal><ProductShowcase /></Reveal>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-brand-50 via-white to-fuchsia-50 py-20">
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 animate-blob rounded-full bg-brand-300/40 blur-[100px]" aria-hidden />
        <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 animate-blob rounded-full bg-fuchsia-300/40 blur-[100px] [animation-delay:-8s]" aria-hidden />
        <div className="container-x relative">
          <SectionHead kicker="Planes y precios" title={cheapest ? <>Tu checador desde <span className="gradient-text">{money(cheapest.priceMonthlyCents, cheapest.currency)} al mes</span></> : 'Elige tu plan y empieza hoy'} text={`${trial} días de prueba gratis. Sin tarjeta. Sin plazos forzosos. Cancela cuando quieras.`} />
          <Reveal><PricingSection plans={plans} /></Reveal>
        </div>
      </section>

      {/* CONFIANZA */}
      <section id="negocios" className="scroll-mt-20 py-20">
        <div className="container-x">
          <SectionHead kicker={BUSINESS_COUNT > 0 ? `Más de ${BUSINESS_COUNT} negocios en México ya lo usan` : 'Para negocios como el tuyo'} title={<>Pensado para el <span className="gradient-text">negocio mexicano</span></>} text="Si tienes empleados y un celular, te sirve. Así lo aprovecha cada giro." />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BUSINESSES.map((b, i) => (
              <Reveal key={b.name} delay={(i % 3) * 80}>
                <div className="group flex h-full items-start gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-glow">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-500 group-hover:to-fuchsia-500 group-hover:text-white"><b.icon className="h-6 w-6" /></span>
                  <div><h3 className="font-display text-lg font-bold">{b.name}</h3><p className="mt-1 text-[15px] leading-relaxed text-ink-600">{b.text}</p></div>
                </div>
              </Reveal>
            ))}
          </div>

          {TESTIMONIALS.length > 0 && (
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name + t.business} delay={(i % 3) * 80}>
                  <figure className="flex h-full flex-col rounded-2xl bg-gradient-to-br from-brand-600 to-fuchsia-600 p-6 text-white shadow-glow">
                    <Quote className="h-8 w-8 text-white/50" />
                    <blockquote className="mt-3 flex-1 text-lg font-medium leading-relaxed">{t.quote}</blockquote>
                    <figcaption className="mt-5 text-sm"><span className="block font-extrabold">{t.name}</span><span className="text-brand-100">{t.business}{t.city ? ` · ${t.city}` : ''}</span></figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          )}

          <Reveal className="mt-12">
            <div className="grid gap-4 rounded-3xl bg-ink-50 p-6 sm:grid-cols-3 sm:p-8">
              {[
                { icon: Sparkles, t: 'Pruébalo sin riesgo', s: `${trial} días gratis, sin tarjeta y sin compromiso.` },
                { icon: ShieldCheck, t: 'Tus datos son tuyos', s: 'Si dejas de pagar no se borran: los consultas y exportas.' },
                { icon: Wallet, t: 'Sin plazos forzosos', s: 'Pagas mes a mes y cancelas cuando quieras.' },
              ].map((g) => (
                <div key={g.t} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-soft"><g.icon className="h-5 w-5" /></span>
                  <div><p className="font-display font-bold">{g.t}</p><p className="text-sm text-ink-600">{g.s}</p></div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="scroll-mt-20 bg-ink-50/60 py-20">
        <div className="container-x max-w-3xl">
          <SectionHead kicker="Resolvemos tus dudas" title="Preguntas frecuentes" />
          <Reveal className="mt-10">
            <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-soft">
              {FAQ.map((f) => (
                <details key={f.q} className="group p-5 transition open:bg-brand-50/40 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-lg font-bold">
                    {f.q}<ChevronDown className="h-5 w-5 shrink-0 text-brand-500 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-600">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-4 py-20">
        <div className="container-x">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-fuchsia-600 px-6 py-16 text-center text-white shadow-glow sm:px-12">
              <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
              <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 animate-blob rounded-full bg-amber-300/30 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 animate-blob rounded-full bg-fuchsia-300/40 blur-3xl [animation-delay:-7s]" aria-hidden />
              <div className="relative">
                <h2 className="mx-auto max-w-3xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Empieza hoy y llega al 2027 con tu registro en orden</h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">Crea tu cuenta, agrega a tu equipo y registra tu primera checada hoy mismo. {trial} días gratis, sin tarjeta{cheapest ? `, y después desde ${money(cheapest.priceMonthlyCents, cheapest.currency)} al mes` : ''}.</p>
                <Link href="/registro" className={cn(buttonVariants({ variant: 'light', size: 'lg' }), 'btn-shine mt-8 h-16 px-9 text-lg font-extrabold text-brand-700 hover:scale-[1.04]')}>Comenzar prueba gratis <ArrowRight className="h-5 w-5" /></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
