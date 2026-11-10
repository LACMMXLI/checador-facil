'use client';
import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, Download, LogOut, QrCode as QrIcon, Smartphone, Users, Wifi } from 'lucide-react';
import { QrCode } from '@/components/qr-code';
import { cn } from '@/components/ui';

function randomDemoToken() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'DEMO-' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('');
}

/** QR de ILUSTRACIÓN que cambia cada 30 s igual que el real. No es un código válido para checar. */
export function DemoQr({ size = 200 }: { size?: number }) {
  const [token, setToken] = useState('DEMO-ejemplo');
  const [left, setLeft] = useState(30);
  useEffect(() => {
    setToken(randomDemoToken());
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) { setToken(randomDemoToken()); return 30; }
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);
  const r = 18; const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-block">
      <div className="rounded-2xl bg-white p-3 shadow-soft"><QrCode value={token} size={size} /></div>
      <div className="absolute -right-3 -top-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-soft" title="Cambia cada 30 segundos">
        <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#eceef5" strokeWidth="4" />
          <circle cx="22" cy="22" r={r} fill="none" stroke="#5b38e8" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / 30)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <span className="relative text-xs font-bold text-brand-700">{left}s</span>
      </div>
    </div>
  );
}

function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-[260px] rounded-[2.2rem] border-[7px] border-ink-900 bg-ink-900 shadow-2xl', className)}>
      <div className="relative overflow-hidden rounded-[1.7rem] bg-white">
        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink-900" />
        {children}
      </div>
    </div>
  );
}

const SAMPLE = [
  { n: 'Ana López', s: 'Trabajando', c: 'bg-mint-50 text-mint-700', t: '09:02' },
  { n: 'Bruno Martínez', s: 'Retardo', c: 'bg-amber-50 text-amber-800', t: '09:21' },
  { n: 'Carla Ruiz', s: 'Jornada terminada', c: 'bg-brand-50 text-brand-700', t: '07:58' },
  { n: 'Diego Herrera', s: 'Fuera de turno', c: 'bg-ink-100 text-ink-600', t: '—' },
];

export function MockDashboard() {
  return (
    <PhoneFrame>
      <div className="px-4 pb-4 pt-9">
        <p className="text-[11px] font-semibold text-ink-500">Cafetería Ejemplo</p>
        <p className="font-display text-lg font-extrabold">Hoy en tu negocio</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['4', 'Activos'], ['2', 'Trabajando'], ['1', 'Retardos']].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-ink-50 p-2 text-center"><p className="font-display text-xl font-extrabold">{v}</p><p className="text-[10px] text-ink-500">{l}</p></div>
          ))}
        </div>
        <ul className="mt-3 space-y-2">
          {SAMPLE.map((e) => (
            <li key={e.n} className="flex items-center justify-between rounded-xl border border-ink-100 p-2.5">
              <div><p className="text-xs font-bold">{e.n}</p><p className="text-[10px] text-ink-400">Entrada {e.t}</p></div>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', e.c)}>{e.s}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-4 border-t border-ink-100 py-2 text-center text-[9px] font-semibold text-ink-400">
        <span className="text-brand-600">Inicio</span><span>Empleados</span><span>Asistencias</span><span>Ajustes</span>
      </div>
    </PhoneFrame>
  );
}

export function MockKiosk() {
  return (
    <div className="mx-auto w-full max-w-[440px] rounded-[1.6rem] border-[8px] border-ink-900 bg-gradient-to-b from-brand-950 to-ink-950 p-6 text-center text-white shadow-2xl">
      <p className="text-xs font-semibold text-brand-200">Cafetería Ejemplo · Sucursal Centro</p>
      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums">09:02</p>
      <div className="my-4 flex justify-center"><DemoQr size={170} /></div>
      <p className="font-display font-bold">Escanea para registrar tu asistencia</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-xs text-mint-400"><Wifi className="h-3.5 w-3.5" /> En línea · el código cambia solo</p>
    </div>
  );
}

export function MockScanner() {
  return (
    <PhoneFrame>
      <div className="bg-ink-950 px-4 pb-6 pt-10 text-center text-white">
        <p className="text-xs text-ink-300">Apunta al QR del checador</p>
        <div className="relative mx-auto mt-4 aspect-square w-48 overflow-hidden rounded-2xl bg-ink-800">
          <div className="absolute inset-0 grid place-items-center text-ink-600"><Camera className="h-10 w-10" /></div>
          {['left-3 top-3 border-l-4 border-t-4', 'right-3 top-3 border-r-4 border-t-4', 'bottom-3 left-3 border-b-4 border-l-4', 'bottom-3 right-3 border-b-4 border-r-4'].map((p) => (
            <span key={p} className={cn('absolute h-8 w-8 rounded-sm border-mint-400', p)} />
          ))}
          <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-mint-400/80" />
        </div>
        <p className="mt-4 text-[11px] text-ink-400">Tu cámara sólo se usa para leer el código.</p>
      </div>
    </PhoneFrame>
  );
}

export function MockConfirm() {
  return (
    <PhoneFrame>
      <div className="px-5 pb-6 pt-12 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mint-50"><CheckCircle2 className="h-12 w-12 text-mint-500" /></div>
        <p className="mt-4 font-display text-xl font-extrabold">¡Entrada registrada!</p>
        <p className="mt-1 text-sm text-ink-500">Ana López · Sucursal Centro</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-sm font-bold tabular-nums"><Clock className="h-4 w-4" /> 09:02 hrs</p>
        <p className="mt-4 text-[11px] text-ink-400">Hora oficial del servidor</p>
      </div>
    </PhoneFrame>
  );
}

export function MockReport() {
  const rows = [
    ['Lun 09', 'Ana López', '09:02', '17:05', '8:03', ''],
    ['Lun 09', 'Bruno Martínez', '09:21', '17:00', '7:39', 'Retardo 21 min'],
    ['Mar 10', 'Ana López', '08:58', '17:01', '8:03', ''],
  ];
  return (
    <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <p className="font-display font-bold">Asistencias · Esta semana</p>
        <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"><Download className="h-3.5 w-3.5" /> Exportar Excel</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead className="bg-ink-50 text-ink-500"><tr>{['Fecha', 'Empleado', 'Entrada', 'Salida', 'Horas', 'Nota'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-ink-100">{r.map((c, j) => <td key={j} className={cn('whitespace-nowrap px-3 py-2.5', j === 5 && c && 'font-semibold text-amber-700')}>{c}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}

const TABS = [
  { id: 'panel', label: 'Panel del dueño', icon: Users, title: 'Mira quién está trabajando, en tiempo real', text: 'Desde tu celular ves quién llegó, quién va tarde y quién ya terminó su jornada. Sin hojas de cálculo ni llamadas.', node: <MockDashboard /> },
  { id: 'qr', label: 'QR dinámico', icon: QrIcon, title: 'Un QR que cambia cada 30 segundos', text: 'Deja una tableta o celular en el local con el QR en pantalla. Cambia solo, así una foto vieja no sirve para checar.', node: <MockKiosk /> },
  { id: 'scan', label: 'Escáner del empleado', icon: Smartphone, title: 'Cada empleado checa con su propio celular', text: 'Inicia sesión desde el navegador, toca “Escanear QR” y apunta a la pantalla. Sin instalar ninguna aplicación.', node: <MockScanner /> },
  { id: 'ok', label: 'Confirmación', icon: CheckCircle2, title: 'Confirmación clara al instante', text: 'El empleado ve su entrada o salida con la hora oficial del servidor. Tú decides si se registra automático o con confirmación.', node: <MockConfirm /> },
  { id: 'rep', label: 'Reportes', icon: LogOut, title: 'Horas, retardos y exportación a Excel', text: 'Consulta por día, semana, quincena o mes. Descarga un CSV compatible con Excel cuando lo necesites.', node: <MockReport /> },
];

export function ProductShowcase() {
  const [id, setId] = useState('panel');
  const tab = TABS.find((t) => t.id === id)!;
  return (
    <div>
      <div role="tablist" aria-label="Pantallas del producto" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === id} onClick={() => setId(t.id)}
            className={cn('flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition', t.id === id ? 'bg-ink-900 text-white shadow-lg' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50')}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-2" role="tabpanel">
        <div className="order-2 lg:order-1">
          <h3 className="font-display text-2xl font-extrabold sm:text-3xl">{tab.title}</h3>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">{tab.text}</p>
        </div>
        <div className="order-1 flex justify-center lg:order-2" key={id}><div className="w-full animate-fade-up">{tab.node}</div></div>
      </div>
    </div>
  );
}
