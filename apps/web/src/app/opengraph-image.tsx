import { ImageResponse } from 'next/og';

export const alt = 'Reloj checador en tu celular para tu negocio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#1f1450,#4c2bcc 60%,#c026d3)', color: '#fff' }}>
        <div style={{ fontSize: 40, fontWeight: 800, opacity: 0.9 }}>{brand}</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24, maxWidth: 980 }}>Controla la asistencia de tu equipo desde cualquier lugar</div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85 }}>Reloj checador con QR dinámico · sin instalar nada</div>
      </div>
    ),
    size,
  );
}
