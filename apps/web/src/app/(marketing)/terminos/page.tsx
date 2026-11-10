import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Términos de servicio', alternates: { canonical: '/terminos' } };

export default function Page() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || 'ChecaFácil';
  return (
    <article className="container-x max-w-3xl space-y-6 py-14 leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="font-display text-4xl font-extrabold text-ink-900">Términos de servicio</h1>
      <p className="text-sm text-ink-500">Última actualización: noviembre de 2026</p>
      <p>Al crear una cuenta en {brand} aceptas estos términos.</p>
      <h2>1. El servicio</h2>
      <p>{brand} es una plataforma web de control de asistencia que se usa desde el navegador. Permite registrar entradas y salidas mediante un código QR dinámico o un PIN compartido, consultar horarios, retardos y horas trabajadas, y exportar reportes.</p>
      <h2>2. Prueba gratuita y suscripción</h2>
      <ul>
        <li>La prueba gratuita no requiere tarjeta y su duración se indica al registrarte.</li>
        <li>La suscripción es mensual. En esta versión los pagos se realizan por transferencia: reportas tu pago y lo confirmamos manualmente. Un comprobante enviado no activa el servicio hasta que sea verificado.</li>
        <li>Los precios y los límites de cada plan se muestran en el sitio y pueden cambiar con previo aviso.</li>
      </ul>
      <h2>3. Vencimiento y suspensión</h2>
      <p>Si tu suscripción vence, tienes un periodo de gracia. Después, la cuenta se suspende: no se podrán registrar nuevas checadas ni hacer cambios, pero podrás consultar y exportar tu información. No eliminamos tus datos por falta de pago.</p>
      <h2>4. Uso responsable</h2>
      <ul>
        <li>Eres responsable de la información que captures, de contar con la autorización para tratar los datos de tus empleados y de cumplir con la legislación laboral aplicable.</li>
        <li>Debes mantener la confidencialidad de tus contraseñas y de los PIN de tu equipo.</li>
        <li>No debes intentar acceder a información de otros negocios ni vulnerar la seguridad del servicio.</li>
      </ul>
      <h2>5. Alcance del servicio</h2>
      <p>{brand} es una herramienta de registro de asistencia; no calcula nómina ni sustituye asesoría laboral, contable o legal. El código QR dinámico reduce ciertos riesgos pero no garantiza la presencia física de la persona: puede compartirse una fotografía del código mientras esté vigente. Los registros son tan confiables como el uso que se haga del sistema.</p>
      <h2>6. Disponibilidad</h2>
      <p>Procuramos mantener el servicio disponible, pero no garantizamos que esté libre de interrupciones. Se requiere conexión a internet para checar.</p>
      <h2>7. Cancelación</h2>
      <p>Puedes dejar de usar el servicio en cualquier momento sin plazo forzoso. Puedes solicitar la eliminación definitiva de tu cuenta escribiéndonos.</p>
      <h2>8. Cambios</h2>
      <p>Podemos actualizar estos términos; publicaremos la versión vigente en esta página.</p>
    </article>
  );
}
