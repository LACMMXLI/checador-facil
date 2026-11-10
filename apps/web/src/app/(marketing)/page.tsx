import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, BarChart3, CalendarClock, Check, ChevronDown, Clock, QrCode, ShieldCheck, Smartphone, Sparkles, Store, Tablet, UserPlus, Wallet, Wifi,
} from 'lucide-react';
import { buttonVariants, cn } from '@/components/ui/styles';
import { DemoQr, MockDashboard, ProductShowcase } from '@/components/marketing/showcase';
import { PricingSection } from '@/components/marketing/pricing';
import { formatHistory } from '@/lib/format';
import { getPublicPlans } from '@/lib/public';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: `${process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil'} — Reloj checador en tu celular para tu negocio` },
  alternates: { canonical: '/' },
};

const BENEFITS = [
  { icon: Wallet, title: 'Ahorra en equipo', text: 'Usa la tableta o el celular que ya tienes. Cero relojes costosos y cero mantenimiento.' },
  { icon: Smartphone, title: 'Funciona en cualquier celular', text: 'Android, iPhone, tabletas y computadoras. Todo desde el navegador, sin instalar aplicaciones.' },
  { icon: QrCode, title: 'Un QR que cambia solo', text: 'El código en pantalla cambia cada 30 segundos. Tu equipo lo escanea con su celular y listo.' },
  { icon: Clock, title: 'Retardos al instante', text: 'Con el plan Avanzado defines tu tolerancia y ves quién llegó tarde y cuántos minutos, sin revisar listas.' },
  { icon: CalendarClock, title: 'Horarios y turnos', text: 'Con el plan Avanzado: horarios por día, descansos y turnos nocturnos que cruzan la medianoche.' },
  { icon: BarChart3, title: 'Horas trabajadas, claras', text: 'Cada jornada con su entrada, salida y horas, por día, semana, quincena o mes.' },
  { icon: ShieldCheck, title: 'Correcciones con respaldo', text: 'Si alguien olvida checar, lo corriges con un motivo y queda registro de quién cambió qué.' },
  { icon: Store, title: 'Todos tus locales en un panel', text: 'Con el plan Avanzado administras varias sucursales desde la misma cuenta.' },
];

const STEPS = [
  { icon: UserPlus, title: 'Registra tu negocio', text: 'Crea tu cuenta en un minuto. Sin tarjeta para empezar tu prueba gratis.' },
  { icon: Store, title: 'Agrega a tus empleados', text: 'Nombre y sucursal (y su horario, con el plan Avanzado). Cada quien recibe su PIN y, si quieres, su acceso personal.' },
  { icon: Tablet, title: 'Activa tu checador QR', text: 'Abre el enlace en una tableta, ingresa el código temporal y déjala en el local.' },
  { icon: QrCode, title: 'Tu equipo empieza a checar', text: 'Escanean el QR o usan el PIN compartido. Entrada y salida se alternan solas.' },
  { icon: BarChart3, title: 'Tú lo ves todo en vivo', text: 'Quién está trabajando, quién llegó tarde y las horas de cada quien, estés donde estés.' },
];

export default async function Home() {
  const plans = await getPublicPlans();
  const trial = plans?.length ? Math.max(...plans.map((p) => p.trialDays)) : 7;
  const basic = plans?.[0]; const top = plans && plans.length > 1 ? plans[plans.length - 1] : null;

  const FAQ = [
    { q: '¿Necesito comprar un reloj checador?', a: 'No. Usas una tableta, un celular viejo o una computadora que ya tengas, con el navegador abierto en la pantalla del checador.' },
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
              <Link href="/registro" className={cn(buttonVariants({ size: 'lg' }), 'text-lg')}>Probar gratis {trial} días <ArrowRight className="h-5 w-5" /></Link>
              <Link href="#como-funciona" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-lg')}>Ver cómo funciona</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-600">
              {[`${trial} días gratis, sin tarjeta`, 'Android, iPhone y tabletas', 'Empiezas hoy mismo'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-mint-600" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto flex max-w-[430px] items-center justify-center pb-10">
              <div className="animate-float rounded-[2rem] border-[8px] border-ink-900 bg-gradient-to-b from-brand-950 to-ink-950 p-5 text-center text-white shadow-2xl">
                <p className="text-xs font-semibold text-brand-200">Tu negocio · Sucursal Centro</p>
                <div className="my-4 flex justify-center"><DemoQr size={190} /></div>
                <p className="font-display font-bold">Escanea para registrar tu asistencia</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-mint-400"><Wifi className="h-3.5 w-3.5" /> El código cambia cada 30 s</p>
              </div>
              <div className="absolute -bottom-10 -left-4 hidden scale-[.78] sm:block md:-left-24 lg:-left-32"><MockDashboard /></div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="scroll-mt-20 py-20">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-600">Por qué te conviene</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Controla a tu equipo sin perseguir a nadie</h2>
            <p className="mt-4 text-lg text-ink-600">Sabes quién llegó, quién llegó tarde y cuántas horas trabajó cada persona, al instante y desde tu celular.</p>
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
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Empieza a checar hoy en 5 pasos</h2>
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
            <p className="font-semibold text-brand-600">Míralo en acción</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Así controlas tu negocio desde el celular</h2>
          </div>
          <ProductShowcase />
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="scroll-mt-20 bg-gradient-to-b from-white to-brand-50 py-20">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-600">Planes y precios</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Elige tu plan y empieza hoy</h2>
            <p className="mt-4 text-lg text-ink-600">{trial} días de prueba gratis. Sin tarjeta. Cancela cuando quieras.</p>
          </div>
          <PricingSection plans={plans} />
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Empieza hoy tu prueba gratis de {trial} días</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">Crea tu cuenta, agrega a tu equipo y registra tu primera checada hoy mismo. Sin tarjeta.</p>
            <Link href="/registro" className={cn(buttonVariants({ variant: 'light', size: 'lg' }), 'mt-8')}>Comenzar prueba gratis <ArrowRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
