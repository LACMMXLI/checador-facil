# ChecaFácil — Reloj checador SaaS (MVP)

Plataforma web para vender un reloj checador por suscripción mensual. Todo funciona desde el navegador
(Android, iPhone, tabletas y computadoras): **sin Electron, sin APK, sin instaladores**.

- **Sitio comercial** público (SEO, planes y precios desde la base de datos, registro con prueba gratis).
- **Panel del propietario** (empleados, horarios, asistencias, correcciones auditadas, CSV, sucursales, dispositivos, suscripción).
- **Portal del empleado** (login, escáner de QR con la cámara, historial).
- **Checador del establecimiento** (`/kiosko`): QR dinámico cada 30 s y/o PIN compartido.
- **Panel SaaS privado** (`/plataforma`): clientes, planes, pagos manuales, renovaciones, MFA.

Estado detallado de qué está probado y qué falta: **[PROGRESO.md](PROGRESO.md)**.

## Stack

Next.js 15 · React 19 · TypeScript estricto · Tailwind · NestJS 11 · Prisma 6 · PostgreSQL · Docker Compose · Coolify.
Monolito modular: un solo backend (`apps/api`) y un solo frontend (`apps/web`) que sirve las cinco áreas.

```
apps/
  api/   NestJS + Prisma (auth, owner, kiosk/employee, platform, billing, attendance/engine)
  web/   Next.js (marketing, registro/login, /panel, /empleado, /kiosko, /plataforma)
docker/  Dockerfiles y entrypoint     scripts/  backup.sh, restore.sh     docs/  despliegue y arquitectura
```

## Desarrollo local

Requisitos: Node 22+, PostgreSQL 15+ (una base vacía y un usuario con acceso).

```bash
npm install
cp .env.example .env            # edita DATABASE_URL, APP_SECRET, etc.
cp .env apps/api/.env           # Prisma/Nest leen apps/api/.env
cd apps/api
npx prisma migrate deploy       # crea las tablas, índices parciales y triggers
npx ts-node prisma/seed.ts --demo   # planes + admin SaaS (+ negocio de demostración ficticio)
cd ../..
npm run build -w @reloj/api && node apps/api/dist/main.js     # API en :4000 (/api)
npm run dev -w @reloj/web                                       # Web en :3000 (reenvía /api al API)
```

Para desarrollo sin SMTP, los enlaces de correo (verificación, recuperación, invitaciones) se imprimen en la consola del API.
Con `REQUIRE_EMAIL_VERIFICATION=false` el registro entra directo.

**Demostración** (`--demo`, datos 100 % ficticios, aislados de clientes reales y excluidos de las métricas):

| Qué | Usuario | Clave |
|---|---|---|
| Dueño demo | `demo@demo.checafacil.local` | `Demo#2027demo` |
| Admin SaaS | el de `PLATFORM_ADMIN_EMAIL` | el de `PLATFORM_ADMIN_PASSWORD` |
| PINs demo | 100001, 100112, 100223, 100334, 100445 | — |

## Pruebas

```bash
cd apps/api && npx jest --runInBand     # 70 pruebas: motor de asistencia, suscripciones, flujos completos con BD real
```
Usan la base indicada en `TEST_DATABASE_URL` (se vacía en cada prueba; **no apuntes a datos reales**).

## Despliegue

Ver **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)** (Docker Compose, Coolify, HTTPS, variables, respaldos y restauración).

## Documentos

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — decisiones, seguridad, reglas de asistencia y de suscripción.
- [PROGRESO.md](PROGRESO.md) — implementado / probado / pendiente (sin maquillaje).
