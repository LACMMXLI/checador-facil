#!/usr/bin/env bash
# Respaldo manual de la base de datos (formato custom de pg_dump).
# Uso:  DATABASE_URL="postgresql://usuario:clave@host:5432/reloj_saas" ./scripts/backup.sh [carpeta_destino]
# Con Docker Compose:  docker compose exec backup sh -c 'pg_dump -Fc -f /backups/manual_$(date +%F_%H%M).dump'
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL}"
DEST="${1:-./backups}"
mkdir -p "$DEST"
FILE="$DEST/reloj_$(date +%Y-%m-%d_%H%M%S).dump"
# pg_dump no admite el parámetro ?schema=… de Prisma: se retira.
pg_dump -Fc "${DATABASE_URL%%\?*}" -f "$FILE"
echo "Respaldo creado: $FILE ($(du -h "$FILE" | cut -f1))"
