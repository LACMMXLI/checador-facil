import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import './globals.css';

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['500', '600', '700', '800'] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: `${BRAND} — Reloj checador en tu celular para negocios`, template: `%s · ${BRAND}` },
  description: 'Controla la asistencia de tu equipo desde cualquier lugar. Tus empleados checan entrada y salida con un QR dinámico desde su celular, sin comprar relojes ni instalar apps.',
  applicationName: BRAND,
  manifest: '/manifest.webmanifest',
  openGraph: { type: 'website', locale: 'es_MX', siteName: BRAND, title: `${BRAND} — Reloj checador en tu celular`, description: 'Asistencia, retardos y horas trabajadas desde el navegador. Sin relojes costosos y sin instalar nada.' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#5b38e8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${body.variable} ${display.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
