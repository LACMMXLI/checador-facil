'use client';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * QR real renderizado en canvas (corrección de errores M). `size` son los píxeles reales del bitmap;
 * `cssWidth` permite escalarlo con CSS (p. ej. 'min(70vw, 40vh)') sin perder nitidez.
 */
export function QrCode({ value, size = 256, cssWidth, className }: { value: string; size?: number; cssWidth?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, value, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0d0e18', light: '#ffffff' } })
      .then(() => {
        // La librería fija width/height en píxeles; se restablece el tamaño responsivo.
        canvas.style.width = cssWidth ?? `${size}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.aspectRatio = '1';
      })
      .catch(() => undefined);
  }, [value, size, cssWidth]);
  return <canvas ref={ref} width={size} height={size} className={className} aria-label="Código QR para registrar asistencia" role="img" />;
}
