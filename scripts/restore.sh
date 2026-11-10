#!/usr/bin/env bash
# Restaura un respaldo en la base indicada. ¡Reemplaza el contenido existente de esa base!
# Uso:  DATABASE_URL="postgresql://usuario:clave@host:5432/reloj_saas" ./scripts/restore.sh ruta/al/respaldo.dump
# Con Docker Compose (detén primero api y web):
#   docker compose stop api web
#   docker compose cp ./respaldo.dump db:/tmp/r.dump
#   docker compose exec db pg_restore -U reloj -d reloj_saas --clean --if-exists --no-owner /tmp/r.dump
#   docker compose start api web
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL}"
FILE="${1:?Indica el archivo .dump}"
[ -f "$FILE" ] || { echo "No existe $FILE"; exit 1; }
read -r -p "Esto reemplazará los datos de la base destino. Escribe SI para continuar: " ok
[ "$ok" = "SI" ] || { echo "Cancelado."; exit 1; }
pg_restore --clean --if-exists --no-owner -d "${DATABASE_URL%%\?*}" "$FILE"
echo "Restauración completa."
