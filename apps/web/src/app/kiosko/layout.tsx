import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Checador', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#1f1450', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false };

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh select-none bg-gradient-to-br from-brand-950 via-ink-950 to-ink-950 text-white">{children}</div>;
}
