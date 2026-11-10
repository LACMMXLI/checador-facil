/**
 * Planes iniciales. Estructura pensada para que Básico sea claramente limitado y Avanzado sea la opción
 * evidente por una diferencia pequeña de precio. Los límites (empleados, sucursales, historial, exportación)
 * los impone el servidor; el administrador SaaS puede editarlos desde el panel.
 */
export const DEFAULT_PLANS = [
  {
    code: 'basico', name: 'Básico', description: 'Para empezar con tu primer local', priceMonthlyCents: 14900,
    maxEmployees: 5, maxBranches: 1, trialDays: 7, historyDays: 7, canExport: false, sortOrder: 1, highlighted: false,
    features: ['Checada con QR dinámico', 'Checada con PIN compartido', 'Horarios y turnos nocturnos', 'Control de retardos'],
  },
  {
    code: 'avanzado', name: 'Avanzado', description: 'Para negocios que quieren crecer sin límites incómodos', priceMonthlyCents: 24900,
    maxEmployees: 50, maxBranches: 3, trialDays: 7, historyDays: 365, canExport: true, sortOrder: 2, highlighted: true,
    features: ['Todo lo del plan Básico', 'Administración multisucursal', 'Correcciones y registro manual con bitácora'],
  },
];
