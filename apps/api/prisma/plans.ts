/**
 * Planes iniciales. Básico = asistencia simple (quién entró, quién salió y cuántas horas). Avanzado = control completo
 * (horarios, turnos nocturnos, retardos, varias sucursales, historial amplio y Excel).
 * Los límites los impone el servidor; el administrador SaaS puede editarlos desde el panel.
 */
export const DEFAULT_PLANS = [
  {
    code: 'basico', name: 'Básico', description: 'Asistencia simple para tu primer local', priceMonthlyCents: 14900,
    maxEmployees: 5, maxBranches: 1, trialDays: 7, historyDays: 7, canExport: false, canSchedules: false, canLateControl: false,
    sortOrder: 1, highlighted: false,
    features: ['Checada con QR dinámico', 'Checada con PIN compartido', 'Entradas, salidas y horas trabajadas'],
  },
  {
    code: 'avanzado', name: 'Avanzado', description: 'Control completo de horarios, retardos y reportes', priceMonthlyCents: 24900,
    maxEmployees: 50, maxBranches: 3, trialDays: 7, historyDays: 365, canExport: true, canSchedules: true, canLateControl: true,
    sortOrder: 2, highlighted: true,
    features: ['Todo lo del plan Básico', 'Administración multisucursal', 'Correcciones y registro manual con bitácora'],
  },
];
