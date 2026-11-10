export const DEFAULT_PLANS = [
  {
    code: 'basico', name: 'Básico', description: 'Para un solo local', priceMonthlyCents: 14900, maxEmployees: 15, maxBranches: 1, trialDays: 14, sortOrder: 1,
    features: ['1 sucursal', 'Hasta 15 empleados', 'Checada con QR dinámico', 'Checada con PIN compartido', 'Horarios y turnos nocturnos', 'Reportes y exportación a Excel'],
  },
  {
    code: 'negocio', name: 'Negocio', description: 'Para varios locales', priceMonthlyCents: 24900, maxEmployees: 50, maxBranches: 3, trialDays: 14, sortOrder: 2, highlighted: true,
    features: ['Hasta 3 sucursales', 'Hasta 50 empleados', 'Todo lo del plan Básico', 'Administración multisucursal'],
  },
];
