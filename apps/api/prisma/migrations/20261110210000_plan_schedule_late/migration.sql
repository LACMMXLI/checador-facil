-- Horarios/turnos y control de retardos pasan a ser funciones del plan Avanzado.
ALTER TABLE "Plan" ADD COLUMN "canSchedules" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Plan" ADD COLUMN "canLateControl" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Plan" SET
  "canSchedules" = false, "canLateControl" = false,
  "description" = 'Asistencia simple para tu primer local',
  "features" = ARRAY['Checada con QR dinámico', 'Checada con PIN compartido', 'Entradas, salidas y horas trabajadas']
WHERE "code" = 'basico';

UPDATE "Plan" SET
  "canSchedules" = true, "canLateControl" = true,
  "description" = 'Control completo de horarios, retardos y reportes',
  "features" = ARRAY['Todo lo del plan Básico', 'Administración multisucursal', 'Correcciones y registro manual con bitácora']
WHERE "code" = 'avanzado';
