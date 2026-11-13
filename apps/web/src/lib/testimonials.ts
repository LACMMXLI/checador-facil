/**
 * Testimonios REALES de clientes. La sección del sitio sólo aparece cuando esta lista tiene al menos uno.
 * Agrega únicamente opiniones de clientes verdaderos y con su permiso (la publicidad con testimonios
 * inventados es engañosa y sancionable por PROFECO).
 *
 * Ejemplo:
 *   { quote: 'Ya no reviso libretas…', name: 'Nombre Apellido', business: 'Nombre del negocio', city: 'Ciudad' },
 */
export interface Testimonial { quote: string; name: string; business: string; city?: string }

export const TESTIMONIALS: Testimonial[] = [];

/** Número real de negocios activos para mostrar "Más de N negocios nos usan". Déjalo en 0 hasta que sea cierto. */
export const BUSINESS_COUNT = 0;
