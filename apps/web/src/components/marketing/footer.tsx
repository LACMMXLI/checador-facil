import Link from 'next/link';
import { Logo } from '@/components/ui';

export function SiteFooter({ contactEmail, whatsapp }: { contactEmail?: string; whatsapp?: string }) {
  const wa = whatsapp?.replace(/\D/g, '');
  return (
    <footer className="bg-ink-950 text-ink-300">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">Reloj checador por internet para negocios pequeños y medianos. Funciona desde el navegador del celular: sin relojes costosos, sin apps que instalar.</p>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">Producto</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/#como-funciona">Cómo funciona</Link></li>
            <li><Link className="hover:text-white" href="/#precios">Planes y precios</Link></li>
            <li><Link className="hover:text-white" href="/#preguntas">Preguntas frecuentes</Link></li>
            <li><Link className="hover:text-white" href="/login">Iniciar sesión</Link></li>
            <li><Link className="hover:text-white" href="/empleado">Soy empleado</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">Contacto y legal</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {contactEmail && <li><a className="hover:text-white" href={`mailto:${contactEmail}`}>{contactEmail}</a></li>}
            {wa && <li><a className="hover:text-white" href={`https://wa.me/${wa}`} rel="noopener noreferrer">WhatsApp</a></li>}
            <li><Link className="hover:text-white" href="/privacidad">Aviso de privacidad</Link></li>
            <li><Link className="hover:text-white" href="/terminos">Términos de servicio</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-ink-500">© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil'}. Todos los derechos reservados.</div>
    </footer>
  );
}
