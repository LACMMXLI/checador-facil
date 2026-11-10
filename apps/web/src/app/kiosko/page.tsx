'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Delete, Maximize, QrCode as QrIcon, Hash, Wifi, WifiOff, CheckCircle2, XCircle, LogIn, LogOut } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { QrCode } from '@/components/qr-code';
import { Button, Logo, Spinner, cn } from '@/components/ui';

interface State { tenantName: string; branchName: string; timezone: string; punchMode: 'QR_ONLY' | 'PIN_ONLY' | 'QR_AND_PIN'; operational: boolean; serverTime: string; qrTtlSeconds: number }
interface QrRes { payload: string; expiresAt: string; serverTime: string; ttlSeconds: number; recent: Recent[] }
interface Recent { name: string; type: 'IN' | 'OUT'; time: string }
interface PinRes { type: 'IN' | 'OUT'; employeeName: string; atLocal: string; lateMinutes: number }

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 60);

export default function Kiosk() {
  const [state, setState] = useState<State | null>(null);
  const [phase, setPhase] = useState<'loading' | 'unlinked' | 'ready' | 'suspended'>('loading');
  const [online, setOnline] = useState(true);
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const s = await api<State>('/kiosk/state');
      offsetRef.current = new Date(s.serverTime).getTime() - Date.now();
      setState(s); setOnline(true);
      setPhase(s.operational ? 'ready' : 'suspended');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setPhase('unlinked');
      else if (e instanceof ApiError && e.code === 'NETWORK') { setOnline(false); setTimeout(load, 4000); }
      else setPhase('unlinked');
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Callbacks estables: los paneles hijos reinician su ciclo de QR si estas funciones cambian de identidad.
  const toUnlinked = useCallback(() => setPhase('unlinked'), []);
  const toSuspended = useCallback(() => setPhase('suspended'), []);

  // Reloj con la hora del servidor
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offsetRef.current), 1000); return () => clearInterval(t); }, []);
  // Reintenta periódicamente el estado (suspensión, cambios de modo)
  useEffect(() => { if (phase === 'ready' || phase === 'suspended') { const t = setInterval(load, 60_000); return () => clearInterval(t); } }, [phase, load]);

  // Mantener la pantalla encendida
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => { try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* no soportado */ } };
    if (phase === 'ready') { req(); const v = () => document.visibilityState === 'visible' && req(); document.addEventListener('visibilitychange', v); return () => { document.removeEventListener('visibilitychange', v); lock?.release().catch(() => undefined); }; }
  }, [phase]);

  if (phase === 'loading') return <div className="grid min-h-dvh place-items-center"><Spinner className="h-10 w-10 text-white" /></div>;
  if (phase === 'unlinked') return <Activate onLinked={load} />;

  const tz = state?.timezone ?? 'America/Mexico_City';
  const time = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const date = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <div className="flex min-h-dvh flex-col p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-extrabold sm:text-2xl">{state?.tenantName}</p>
          <p className="truncate text-brand-200">{state?.branchName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', online ? 'bg-mint-500/15 text-mint-400' : 'bg-red-500/20 text-red-300')}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? 'En línea' : 'Sin conexión'}
          </span>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)} className="hidden rounded-lg p-2 text-ink-300 hover:bg-white/10 sm:block" aria-label="Pantalla completa"><Maximize className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="mt-2 text-center">
        <p className="font-display text-5xl font-extrabold tabular-nums leading-none sm:text-6xl">{time}</p>
        <p className="mt-1 text-lg first-letter:uppercase text-ink-300">{date}</p>
      </div>

      {phase === 'suspended' ? (
        <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white/10 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-400" />
          <p className="mt-4 font-display text-2xl font-extrabold">Servicio suspendido</p>
          <p className="mt-2 text-ink-200">Avisa al dueño del negocio para reactivar el checador.</p>
        </div>
      ) : (
        <Modes mode={state!.punchMode} setOnline={setOnline} onUnlinked={toUnlinked} onSuspended={toSuspended} />
      )}
    </div>
  );
}

function Modes({ mode, setOnline, onUnlinked, onSuspended }: { mode: State['punchMode']; setOnline: (v: boolean) => void; onUnlinked: () => void; onSuspended: () => void }) {
  const [tab, setTab] = useState<'qr' | 'pin'>(mode === 'PIN_ONLY' ? 'pin' : 'qr');
  useEffect(() => { setTab(mode === 'PIN_ONLY' ? 'pin' : 'qr'); }, [mode]);
  const both = mode === 'QR_AND_PIN';
  return (
    <div className="mt-4 flex flex-1 flex-col">
      {both && (
        <div className="mx-auto mb-4 flex rounded-full bg-white/10 p-1 lg:hidden" role="tablist">
          {([['qr', 'Código QR', QrIcon], ['pin', 'Usar PIN', Hash]] as const).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('flex items-center gap-2 rounded-full px-5 py-2 font-semibold transition', tab === k ? 'bg-white text-ink-900' : 'text-ink-200')}><Icon className="h-4 w-4" />{l}</button>
          ))}
        </div>
      )}
      <div className={cn('flex flex-1 items-start justify-center gap-10 lg:items-center', both && 'lg:justify-around')}>
        {mode !== 'PIN_ONLY' && <div className={cn('w-full max-w-xl', both && tab !== 'qr' && 'hidden lg:block')}><QrPanel setOnline={setOnline} onUnlinked={onUnlinked} onSuspended={onSuspended} /></div>}
        {mode !== 'QR_ONLY' && <div className={cn('w-full max-w-sm', both && tab !== 'pin' && 'hidden lg:block')}><PinPanel setOnline={setOnline} onUnlinked={onUnlinked} onSuspended={onSuspended} /></div>}
      </div>
    </div>
  );
}

function QrPanel({ setOnline, onUnlinked, onSuspended }: { setOnline: (v: boolean) => void; onUnlinked: () => void; onSuspended: () => void }) {
  const [qr, setQr] = useState<QrRes | null>(null);
  const [left, setLeft] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const offsetRef = useRef(0);
  const expRef = useRef(0);

  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const rotate = async () => {
      try {
        const r = await api<QrRes>('/kiosk/qr', { body: {} });
        if (!alive) return;
        offsetRef.current = new Date(r.serverTime).getTime() - Date.now();
        expRef.current = new Date(r.expiresAt).getTime();
        setQr(r); setRecent(r.recent); setOnline(true);
        // Genera el siguiente antes de que expire el actual, para que siempre haya uno vigente en pantalla.
        const wait = Math.max(expRef.current - (Date.now() + offsetRef.current) - 4000, 3000);
        timer = setTimeout(rotate, wait);
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.code === 'DEVICE_UNLINKED') return onUnlinked();
        if (e instanceof ApiError && e.code === 'SUBSCRIPTION_SUSPENDED') return onSuspended();
        if (e instanceof ApiError && e.code === 'NETWORK') setOnline(false);
        timer = setTimeout(rotate, 3000);
      }
    };
    rotate();
    return () => { alive = false; clearTimeout(timer); };
  }, [setOnline, onUnlinked, onSuspended]);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((expRef.current - (Date.now() + offsetRef.current)) / 1000))), 500);
    return () => clearInterval(t);
  }, []);

  const expired = !qr || left <= 0;
  const ttl = qr?.ttlSeconds ?? 30;
  return (
    <div className="text-center">
      <div className="relative mx-auto inline-block rounded-[2rem] bg-white p-4 shadow-2xl sm:p-5">
        {qr ? <QrCode value={qr.payload} size={560} cssWidth="min(70vw, 40vh, 420px)" /> : <div className="grid h-[min(78vw,52vh,460px)] w-[min(78vw,52vh,460px)] place-items-center"><Spinner className="h-10 w-10" /></div>}
        {qr && expired && <div className="absolute inset-0 grid place-items-center rounded-[2rem] bg-white/90 text-ink-800"><div><Spinner className="mx-auto h-8 w-8" /><p className="mt-2 font-semibold">Actualizando código…</p></div></div>}
      </div>
      <div className="mx-auto mt-4 h-2 w-full max-w-[460px] overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400 transition-[width] duration-500" style={{ width: `${Math.min(100, (left / ttl) * 100)}%` }} />
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">Escanea para registrar tu asistencia</p>
      <p className="mt-1 text-ink-300">Abre tu portal en el celular, toca “Escanear QR” y apunta aquí.</p>
      {recent.length > 0 && (
        <ul className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2">
          {recent.map((r, i) => <li key={i} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">{r.type === 'IN' ? <LogIn className="h-3.5 w-3.5 text-mint-400" /> : <LogOut className="h-3.5 w-3.5 text-brand-300" />}{r.name} · {r.time}</li>)}
        </ul>
      )}
    </div>
  );
}

function PinPanel({ setOnline, onUnlinked, onSuspended }: { setOnline: (v: boolean) => void; onUnlinked: () => void; onSuspended: () => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<PinRes | null>(null);
  const [err, setErr] = useState('');
  const idRef = useRef(newId());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const press = (d: string) => { if (busy || ok) return; setErr(''); setPin((p) => (p.length < 6 ? p + d : p)); };
  const back = () => { if (!busy && !ok) setPin((p) => p.slice(0, -1)); };

  async function submit() {
    if (pin.length !== 6 || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api<PinRes>('/kiosk/pin', { body: { pin, scanId: idRef.current } });
      setOnline(true); setOk(r); idRef.current = newId(); setPin('');
      timer.current = setTimeout(() => setOk(null), 3500); // regresa solo a la pantalla principal
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'DEVICE_UNLINKED') return onUnlinked();
        if (e.code === 'SUBSCRIPTION_SUSPENDED') return onSuspended();
        if (e.code === 'NETWORK') setOnline(false);
        setErr(e.message);
      } else setErr('No pudimos registrar tu asistencia. Inténtalo nuevamente.');
      if (!(e instanceof ApiError && e.code === 'NETWORK')) idRef.current = newId();
      setPin('');
      timer.current = setTimeout(() => setErr(''), 4000);
    }
    setBusy(false);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="relative mx-auto w-full max-w-xs">
      {ok && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-mint-600 p-4 text-center animate-pop" role="status">
          <div>
            <CheckCircle2 className="mx-auto h-20 w-20" />
            <p className="mt-3 font-display text-2xl font-extrabold">{ok.type === 'IN' ? 'Entrada registrada' : 'Salida registrada'}</p>
            <p className="mt-1 text-lg">{ok.employeeName}</p>
            <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">{ok.atLocal.slice(11)}</p>
            {ok.type === 'IN' && ok.lateMinutes > 0 && <p className="mt-2 rounded-xl bg-black/20 px-3 py-1 text-sm font-semibold">Retardo: {ok.lateMinutes} min</p>}
          </div>
        </div>
      )}
      <p className="mb-3 text-center font-display text-xl font-bold">Ingresa tu PIN</p>
      <div className="mb-4 flex justify-center gap-3" aria-label={`${pin.length} de 6 dígitos`}>
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={cn('h-4 w-4 rounded-full border-2 transition', i < pin.length ? 'border-white bg-white' : 'border-white/40')} />)}
      </div>
      <div className="h-12 text-center" aria-live="assertive">
        {err && <p className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200"><XCircle className="h-4 w-4 shrink-0" />{err}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} onClick={() => press(d)}>{d}</Key>)}
        <Key onClick={() => setPin('')} dim aria="Borrar todo">C</Key>
        <Key onClick={() => press('0')}>0</Key>
        <Key onClick={back} dim aria="Borrar"><Delete className="mx-auto h-6 w-6" /></Key>
      </div>
      <Button size="lg" className="mt-4 h-16 w-full text-xl" disabled={pin.length !== 6} loading={busy} onClick={submit}>Confirmar</Button>
    </div>
  );
}

const Key = ({ children, onClick, dim, aria }: { children: React.ReactNode; onClick: () => void; dim?: boolean; aria?: string }) => (
  <button type="button" onClick={onClick} aria-label={aria} className={cn('h-16 rounded-2xl font-display text-2xl font-bold transition active:scale-95', dim ? 'bg-white/5 text-ink-200 hover:bg-white/10' : 'bg-white/10 hover:bg-white/20')}>{children}</button>
);

function Activate({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/kiosk/activate', { body: { code } }); onLinked(); } catch (er) { setErr(er instanceof ApiError ? er.message : 'No pudimos vincular este equipo.'); setBusy(false); }
  }
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 text-ink-900 shadow-2xl">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center font-display text-2xl font-extrabold">Vincular este equipo como checador</h1>
        <p className="mt-2 text-center text-ink-600">En el panel del negocio ve a <strong>Configuración → Vincular tableta</strong> y escribe aquí el código.</p>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
          className="mt-6 h-16 w-full rounded-2xl border border-ink-200 text-center font-mono text-3xl font-bold tracking-[.3em] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" placeholder="········" aria-label="Código de vinculación" />
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-center text-sm font-medium text-red-700" role="alert">{err}</p>}
        <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} disabled={code.length !== 8}>Vincular</Button>
      </form>
    </div>
  );
}
