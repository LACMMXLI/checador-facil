-- Límites por plan: historial de reportes y exportación; prueba de 7 días.
ALTER TABLE "Plan" ALTER COLUMN "trialDays" SET DEFAULT 7;
ALTER TABLE "Plan" ADD COLUMN "historyDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "Plan" ADD COLUMN "canExport" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_history_chk" CHECK ("historyDays" >= 1);

-- Reconfiguración de los dos planes iniciales (sólo si existen; un plan editado a mano con otro código no se toca).
UPDATE "Plan" SET
  "name" = 'Básico',
  "description" = 'Para empezar con tu primer local',
  "maxEmployees" = 5, "maxBranches" = 1, "trialDays" = 7, "historyDays" = 7, "canExport" = false,
  "highlighted" = false, "sortOrder" = 1,
  "features" = ARRAY['Checada con QR dinámico', 'Checada con PIN compartido', 'Horarios y turnos nocturnos', 'Control de retardos']
WHERE "code" = 'basico';

UPDATE "Plan" SET
  "code" = 'avanzado',
  "name" = 'Avanzado',
  "description" = 'Para negocios que quieren crecer sin límites incómodos',
  "maxEmployees" = 50, "maxBranches" = 3, "trialDays" = 7, "historyDays" = 365, "canExport" = true,
  "highlighted" = true, "sortOrder" = 2,
  "features" = ARRAY['Todo lo del plan Básico', 'Administración multisucursal', 'Correcciones y registro manual con bitácora']
WHERE "code" = 'negocio';
