import type { Metadata } from 'next';
import { getPublicConfig } from '@/lib/public';

export const metadata: Metadata = { title: 'Aviso de privacidad', alternates: { canonical: '/privacidad' } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const cfg = await getPublicConfig();
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil';
  const mail = cfg?.contactEmail || 'el correo de contacto publicado en este sitio';
  return (
    <article className="container-x max-w-3xl space-y-6 py-14 leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="font-display text-4xl font-extrabold text-ink-900">Aviso de privacidad</h1>
      <p className="text-sm text-ink-500">Última actualización: noviembre de 2026</p>
      <p>{brand} (en adelante, “el Proveedor”) es responsable del tratamiento de los datos personales que se recaban a través de esta plataforma, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
      <h2>Datos que recabamos</h2>
      <ul>
        <li><strong>Del propietario del negocio:</strong> nombre, correo electrónico, nombre del negocio y contraseña (almacenada cifrada con un algoritmo de un solo sentido).</li>
        <li><strong>De los empleados, capturados por el negocio:</strong> nombre, número de empleado, sucursal, horario, teléfono y correo (opcionales), y los registros de entrada y salida con su fecha y hora.</li>
        <li><strong>Técnicos:</strong> dirección IP y tipo de navegador, para seguridad y prevención de abuso.</li>
      </ul>
      <p>No recabamos huellas, fotografías ni ubicación geográfica. La cámara del celular se usa únicamente, y sólo mientras la pantalla de escaneo está abierta, para leer el código QR; no se graban ni se envían imágenes.</p>
      <h2>Finalidades</h2>
      <p>Proveer el servicio de control de asistencia, administrar tu suscripción y pagos, brindar soporte, enviar avisos del servicio y mantener la seguridad de la plataforma.</p>
      <h2>Funciones de cada parte</h2>
      <p>El negocio que contrata el servicio es responsable de la información de sus empleados y de informarles sobre su tratamiento; el Proveedor la trata únicamente por cuenta del negocio para prestar el servicio.</p>
      <h2>Transferencias</h2>
      <p>No vendemos ni compartimos datos personales con terceros, salvo proveedores de infraestructura necesarios para operar el servicio (alojamiento y correo electrónico) o cuando una autoridad competente lo requiera.</p>
      <h2>Conservación</h2>
      <p>Conservamos la información mientras la cuenta exista. Si la suscripción vence, no eliminamos los datos; el negocio puede consultarlos y exportarlos. Puedes solicitar la eliminación definitiva de tu cuenta.</p>
      <h2>Derechos ARCO</h2>
      <p>Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, o revocar tu consentimiento, escribiendo a {mail}. Los empleados deben dirigir su solicitud, en primer lugar, al negocio para el que trabajan.</p>
      <h2>Cambios</h2>
      <p>Publicaremos cualquier modificación a este aviso en esta página.</p>
    </article>
  );
}
