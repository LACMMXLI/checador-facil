/**
 * Capturas REALES del sistema (cuenta de demostración con datos ficticios), guardadas en /public/capturas.
 * Para actualizarlas, vuelve a capturar las pantallas y reemplaza los archivos con el mismo nombre.
 */
export const SHOTS = {
  panel: { src: '/capturas/panel.webp', w: 1920, h: 1200, alt: 'Panel del dueño: empleados activos, quién está trabajando ahora, entradas y retardos del día' },
  reportes: { src: '/capturas/asistencias.webp', w: 1920, h: 1200, alt: 'Reporte de asistencias de la quincena con entradas, salidas, horas trabajadas y retardos' },
  kiosko: { src: '/capturas/kiosko.webp', w: 1770, h: 1140, alt: 'Pantalla del checador en una tableta con código QR dinámico y teclado de PIN' },
  movil: { src: '/capturas/panel-movil.webp', w: 780, h: 1560, alt: 'Panel del dueño visto desde un celular' },
} as const;
export type Shot = (typeof SHOTS)[keyof typeof SHOTS];

