#!/bin/sh
set -e
echo "→ Aplicando migraciones…"
npx prisma migrate deploy
echo "→ Sembrando planes y administrador (idempotente)…"
npx ts-node prisma/seed.ts
exec "$@"
