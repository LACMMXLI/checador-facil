'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { AlertCircle, ArrowLeft, CameraOff, CheckCircle2, Clock, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Spinner, cn } from '@/components/ui';
import { hhmm } from '@/lib/format';

type Phase = 'starting' | 'scanning' | 'sending' | 'confirm' | 'done' | 'error' | 'nocamera';
interface Result {
  requiresConfirmation: boolean; type: 'IN' | 'OUT'; employeeName: string; branchName: string; atLocal?: string; lateMinutes?: number; workedMinutes?: number; duplicate?: boolean;
}

function newId() { return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 60); }

export default function Scan() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const scanIdRef = useRef(newId());
  const payloadRef = useRef('');
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const send = useCallback(async (payload: string, confirm: boolean) => {
    setPhase('sending');
    try {
      const r = await api<Result>('/employee/scan', { body: { payload, scanId: scanIdRef.current, confirm: confirm || undefined } });
      payloadRef.current = payload;
      if (r.requiresConfirmation) { setResult(r); setPhase('confirm'); } else { setResult(r); setPhase('done'); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace('/empleado/login'); return; }
      setMessage(e instanceof ApiError ? (e.code === 'NETWORK' ? 'No hay conexión a internet. Conéctate e inténtalo de nuevo.' : e.message) : 'No pudimos registrar tu asistencia. Inténtalo nuevamente.');
      setPhase('error');
    }
  }, [router]);

  const startCamera = useCallback(async () => {
    setPhase('starting'); busyRef.current = false; scanIdRef.current = newId();
    if (typeof window !== 'undefined' && !window.isSecureContext) { setMessage('La cámara sólo funciona en una conexión segura (HTTPS). Avisa a tu encargado.'); setPhase('nocamera'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('Tu navegador no permite usar la cámara. Prueba con Chrome o Safari actualizados.'); setPhase('nocamera'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream; v.setAttribute('playsinline', 'true');
      await v.play();
      setPhase('scanning');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      let last = 0;
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (busyRef.current || t - last < 110 || v.readyState < 2 || !v.videoWidth) return;
        last = t;
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.floor(v.videoWidth * scale); canvas.height = Math.floor(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          busyRef.current = true;
          stopCamera();
          if (navigator.vibrate) navigator.vibrate(60);
          if (code.data.startsWith('RS1.')) send(code.data, false);
          else { setMessage('Ese código no es del checador. Escanea el QR que está en la pantalla del local.'); setPhase('error'); }
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setMessage('La cámara está bloqueada. Activa el permiso de cámara para este sitio en la configuración de tu navegador y vuelve a intentarlo.');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setMessage('No encontramos una cámara en este dispositivo.');
      else setMessage('No pudimos abrir la cámara. Cierra otras apps que la estén usando e inténtalo de nuevo.');
      setPhase('nocamera');
    }
  }, [send, stopCamera]);

  useEffect(() => { startCamera(); return stopCamera; }, [startCamera, stopCamera]);

  const finish = result?.type === 'IN' ? 'Entrada registrada' : 'Salida registrada';

  return (
    <div className="-mx-4 -mt-6 flex min-h-dvh flex-col bg-ink-950 text-white">
      <div className="flex items-center gap-2 p-4">
        <Link href="/empleado" onClick={stopCamera} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-200 hover:bg-white/10"><ArrowLeft className="h-4 w-4" />Volver</Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
        {(phase === 'starting' || phase === 'scanning') && (
          <>
            <p className="mb-4 text-center text-lg font-semibold">Apunta al QR del checador</p>
            <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-white/10">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              {phase === 'starting' && <div className="absolute inset-0 grid place-items-center bg-ink-900"><Spinner className="h-8 w-8 text-white" /></div>}
              {['left-4 top-4 border-l-4 border-t-4', 'right-4 top-4 border-r-4 border-t-4', 'bottom-4 left-4 border-b-4 border-l-4', 'bottom-4 right-4 border-b-4 border-r-4'].map((p) => <span key={p} className={cn('absolute h-10 w-10 rounded-sm border-mint-400', p)} />)}
              {phase === 'scanning' && <span className="absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-mint-400/80" />}
            </div>
            <p className="mt-4 max-w-xs text-center text-sm text-ink-300">Acércate hasta que el código quede dentro del marco. La cámara sólo se usa para leer el código.</p>
          </>
        )}

        {phase === 'sending' && <div className="text-center"><Spinner className="mx-auto h-12 w-12 text-white" /><p className="mt-4 text-lg font-semibold">Registrando…</p></div>}

        {phase === 'confirm' && result && (
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center text-ink-900">
            <div className={cn('mx-auto grid h-16 w-16 place-items-center rounded-full', result.type === 'IN' ? 'bg-mint-50 text-mint-600' : 'bg-brand-50 text-brand-600')}>{result.type === 'IN' ? <LogIn className="h-8 w-8" /> : <LogOut className="h-8 w-8" />}</div>
            <p className="mt-4 font-display text-2xl font-extrabold">¿Registrar tu {result.type === 'IN' ? 'entrada' : 'salida'}?</p>
            <p className="mt-1 text-ink-600">{result.employeeName} · {result.branchName}</p>
            <Button size="lg" className="mt-6 h-14 w-full text-lg" onClick={() => send(payloadRef.current, true)}>Confirmar</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push('/empleado')}>Cancelar</Button>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center text-ink-900">
            <div className="mx-auto grid h-24 w-24 animate-pop place-items-center rounded-full bg-mint-50"><CheckCircle2 className="h-16 w-16 text-mint-500" /></div>
            <p className="mt-5 font-display text-3xl font-extrabold">{finish}</p>
            <p className="mt-1 text-lg text-ink-600">{result.employeeName}</p>
            <p className="text-sm text-ink-500">{result.branchName}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-4 py-1.5 text-lg font-bold tabular-nums"><Clock className="h-5 w-5" />{result.atLocal?.slice(11)} hrs</p>
            <p className="mt-1 text-xs text-ink-400">Hora oficial del servidor</p>
            {result.duplicate && <p className="mt-3 text-sm text-ink-500">Esta checada ya estaba registrada.</p>}
            {result.type === 'IN' && !!result.lateMinutes && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">Llegaste {result.lateMinutes} min tarde.</p>}
            {result.type === 'OUT' && !!result.workedMinutes && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-800">Trabajaste {hhmm(result.workedMinutes)} horas. ¡Buen trabajo!</p>}
            <Button size="lg" className="mt-6 w-full" onClick={() => router.push('/empleado')}>Listo</Button>
          </div>
        )}

        {(phase === 'error' || phase === 'nocamera') && (
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center text-ink-900">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50">{phase === 'nocamera' ? <CameraOff className="h-8 w-8 text-red-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}</div>
            <p className="mt-4 font-display text-xl font-extrabold">{phase === 'nocamera' ? 'No podemos usar la cámara' : 'No se pudo registrar'}</p>
            <p className="mt-2 text-ink-600">{message}</p>
            {phase === 'error' && <Button size="lg" className="mt-6 w-full" onClick={startCamera}><RefreshCw className="h-5 w-5" />Escanear de nuevo</Button>}
            {phase === 'nocamera' && <Button size="lg" className="mt-6 w-full" onClick={startCamera}><RefreshCw className="h-5 w-5" />Reintentar</Button>}
            <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push('/empleado')}>Volver al inicio</Button>
          </div>
        )}
      </div>
    </div>
  );
}
