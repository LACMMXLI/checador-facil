import type { MetadataRoute } from 'next';

/** PWA opcional: permite agregar el acceso directo a la pantalla de inicio. El producto funciona igual sin instalarlo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil', short_name: process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil',
    description: 'Reloj checador en tu celular', start_url: '/empleado', display: 'standalone', background_color: '#ffffff', theme_color: '#5b38e8', lang: 'es-MX',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
