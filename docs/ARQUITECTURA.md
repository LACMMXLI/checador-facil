# Arquitectura y decisiones

## Visión general

Monolito modular, un solo backend y un solo frontend para las cinco áreas.

```
Navegador ──HTTPS──▶ web (Next.js)  ──/api/*──▶ api (NestJS) ──▶ PostgreSQL
 (dueño, empleado, kiosco, admin SaaS)           └─ Prisma, sesiones opacas, motor de asistencia
```

- **Frontend** (`apps/web`): SSR para el sitio comercial (SEO, JSON-LD, sitemap, robots, Open Graph); páginas cliente para paneles.
  Se comunica con el API en el mismo origen (`/api`), así las cookies son de primera parte.
- **Backend** (`apps/api`): NestJS + Prisma. Módulos: `auth`, `owner` (panel del negocio), `kiosk` (checador + portal del empleado),
  `platform` (admin SaaS), `billing`, `attendance` (servicio + motor puro), `public` (planes), `common`.
- **Desviación del esquema sugerido:** no se creó `packages/shared`; el motor de asistencia (funciones puras) vive en
  `apps/api/src/attendance/engine.ts`. Nada del frontend lo necesita todavía.
- **shadcn/ui:** los componentes (`components/ui`) están escritos a mano con el mismo enfoque (CVA + tailwind-merge) para no depender del CLI.

## Modelo de datos

`User, PlatformAdmin, Tenant, Membership, Branch, Employee, EmployeeAccount, WorkSchedule, Device, DeviceActivation, QrToken,
PunchEvent, WorkSession, AttendanceAdjustment, Plan, Subscription, Payment, PlatformSetting, AuditLog, AuthSession, VerificationToken`.

Garantías en la **base de datos** (migración `*_init`):

| Regla | Mecanismo |
|---|---|
| Una sola jornada abierta por empleado | índice único parcial `WHERE status='OPEN'` |
| Eventos de checada inmutables | trigger que prohíbe `UPDATE`/`DELETE` en `PunchEvent` |
| Sin checadas duplicadas | `UNIQUE(tenantId, idempotencyKey)` |
| PIN único por negocio | `UNIQUE(tenantId, pinLookup)` |
| Horarios y límites válidos | `CHECK` en minutos, día de semana, límites de plan, meses de pago, fin ≥ inicio |
| Código/QR/dispositivo no adivinables | sólo se guarda `sha256` del token |

## Motor de asistencia

- Instantes en UTC; la sucursal define su zona horaria IANA. Conversión local↔UTC con `Intl` (maneja cambios de horario de verano).
- La jornada pertenece al **día local de su entrada**. Un turno cuya salida es menor o igual a su entrada termina al día siguiente.
- Retardo = minutos tras el inicio programado, sólo si exceden la tolerancia. Salida anticipada análoga. No hay nómina.
- Cada checada corre en una transacción con `pg_advisory_xact_lock` por empleado: dos celulares/kioscos simultáneos no pueden
  abrir dos jornadas; la misma clave de idempotencia devuelve el resultado original.
- **Jornada olvidada:** si pasan más de `maxOpenHours` (16 por defecto) sin salida, se marca `INCOMPLETE` **sin inventar hora de salida**
  y se permite una nueva entrada. Aparece como incidencia en el panel.
- **Correcciones:** nunca se edita ni borra un evento. Se actualiza la jornada y se guarda `AttendanceAdjustment` (valor anterior, nuevo,
  motivo obligatorio, usuario, fecha) más `AuditLog`. Se rechazan empalmes, horas futuras y jornadas de más de 24 h.

## QR dinámico

1. El propietario genera un **código de vinculación** (8 caracteres, 15 min, un solo uso, sólo se guarda su hash).
2. La tableta abre `/kiosko`, lo escribe y recibe una **cookie HttpOnly de dispositivo** (revocable desde el panel).
3. Cada ~26 s el kiosco pide un token aleatorio (24 bytes) con vigencia de 30 s, ligado a dispositivo + sucursal. Sólo se guarda su hash.
   El QR contiene `RS1.<token>`: sin datos personales ni credenciales.
4. El empleado, con **su propia sesión**, escanea y el servidor valida: empleado activo, mismo negocio, sucursal autorizada, dispositivo activo,
   token vigente (5 s de tolerancia; 25 s en confirmación), suscripción operativa, separación mínima y duplicados.
   El token no se invalida al primer uso: lo usan varios empleados durante su vigencia.
5. Modo `CONFIRM`: el primer escaneo sólo previsualiza (no escribe); se guarda al confirmar con el mismo QR aún vigente.

**Límite honesto:** el QR dinámico no prueba presencia física. Una foto del QR puede compartirse mientras esté vigente. El sitio y los
términos lo dicen así; no se vende como infalible.

## Seguridad

- **Contraseñas:** Argon2id (parámetros OWASP). Tiempo igualado cuando el usuario no existe.
- **Sesiones:** token opaco aleatorio en cookie `HttpOnly; SameSite=Lax; Secure` (en producción); en BD sólo el hash; expiración y revocación
  (logout, cambio de contraseña, desactivar empleado, revocar dispositivo). Cuatro sesiones separadas: dueño, empleado, kiosco, admin SaaS.
- **CSRF:** toda petición que modifica datos exige `X-Requested-With: reloj` y, si hay `Origin`, que coincida con `APP_URL`.
- **Fuerza bruta:** limitador de intentos fallidos (login por correo e IP; PIN por dispositivo e IP; código de vinculación por IP) +
  `@nestjs/throttler` global y por ruta. Se respondió con mensajes que no revelan si una cuenta existe.
- **Multiempresa:** el `tenantId` sale de la sesión, nunca del cliente; toda consulta filtra por él; las relaciones se verifican dentro del
  mismo negocio; los accesos cruzados devuelven 404. Hay pruebas automáticas de aislamiento (listados, acceso por id, correcciones,
  dispositivos, QR de otro negocio, PIN, CSV).
- **Row Level Security: NO implementada.** Con Prisma y un pool de conexiones compartido exigiría fijar `app.tenant_id` por transacción en
  cada consulta; hacerlo a medias daría una falsa sensación de seguridad. Queda documentado como mejora futura.
- **Admin SaaS:** login y cookie independientes; MFA TOTP (RFC 6238) obligatorio si `PLATFORM_REQUIRE_MFA=true` o si lo activó. Sin accesos ocultos.
- **Cabeceras:** Helmet en el API; `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` en la web.
- **CSV:** neutraliza inyección de fórmulas de Excel (`= + - @`).
- **Errores:** mensajes comprensibles al usuario; el detalle técnico sólo se registra en el servidor.

## Suscripciones

Estados: `TRIAL, ACTIVE, PAST_DUE, GRACE_PERIOD, SUSPENDED, CANCELED`. El estado **efectivo** se calcula con funciones puras a partir de
fechas (`billing/subscription.ts`, con pruebas): vigente → vencida dentro de `graceDays` → suspendida.

| Estado efectivo | Checar (QR/PIN) | Consultar y exportar | Crear/editar | Reportar pago |
|---|---|---|---|---|
| TRIAL / ACTIVE / PAST_DUE / GRACE_PERIOD | Sí | Sí | Sí | Sí |
| SUSPENDED / CANCELED | **No** (HTTP 402, mensaje claro) | **Sí** | **No** (402) | **Sí** |

- Vencer o suspender **nunca borra datos**.
- El backend impone los límites de empleados y sucursales del plan.
- El cliente no decide montos: el pago reportado se calcula en el servidor (`precio × meses`) y **no activa nada**: lo aprueba el administrador
  (aprobación atómica: dos clics no renuevan dos veces). Toda renovación, cortesía, suspensión o cambio de plan queda en `AuditLog`.
- Pasarela de pago: no implementada. `Payment` y `Subscription` están pensados para añadir Mercado Pago/Stripe (webhook → mismo `renew()`).

## Configurable sin tocar código

Precios, límites, días de prueba, características, orden y visibilidad de planes (panel SaaS → Planes; se refleja en la página pública);
instrucciones de pago, contacto y días de gracia (Ajustes). Tolerancias, modo de checada, confirmación, separación mínima y límite de
jornada olvidada: por sucursal.
