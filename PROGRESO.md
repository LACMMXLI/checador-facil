# PROGRESO

Actualizado: 10-nov-2026. Criterio: **"probado" = ejercitado de extremo a extremo** (pruebas automáticas con backend y PostgreSQL reales, o
comprobado a mano en el navegador). Lo que no cumple eso aparece como pendiente o sin verificar.

## Resumen

El MVP funciona de extremo a extremo con backend y base de datos reales, **salvo** el escaneo con la cámara de un celular real y el despliegue
con Docker/Coolify, que **no se han podido probar** en este entorno (ver "Sin verificar").

## Implementado y probado

Pruebas automáticas: **70 pruebas** (`cd apps/api && npx jest --runInBand`), todas en verde. Base de pruebas separada.

| Área | Estado | Cómo se probó |
|---|---|---|
| Registro → correo sin verificar no entra → verificar (un solo uso) → entra con prueba activa | ✅ | automática |
| Contraseña con letras y números; términos obligatorios; bloqueo tras 5 fallos; mensajes que no revelan cuentas | ✅ | automática |
| Recuperación de contraseña (cierra sesiones anteriores) | ✅ | automática |
| CSRF (rechaza sin encabezado) | ✅ | automática |
| Motor de asistencia: zonas horarias, DST, turnos nocturnos, retardos, tolerancias, salidas anticipadas, rangos de reporte | ✅ | 23 pruebas unitarias |
| Turno 22:00–06:00 = 8 h, pertenece al día de entrada; jornada olvidada → INCOMPLETA sin inventar salida | ✅ | automática con BD |
| Checadas simultáneas: nunca dos jornadas abiertas; misma idempotencia en paralelo → un solo evento | ✅ | automática con BD |
| BD impide 2 jornadas abiertas y modificar/borrar eventos (índice parcial + trigger) | ✅ | automática |
| QR dinámico: vinculación (un uso, caduca), rotación, entrada/salida automática, QR expirado/inventado/de otro formato, revocación | ✅ | automática |
| Modo con confirmación (no escribe hasta confirmar) | ✅ | automática |
| PIN compartido: entrada/salida, único por negocio, no guardado en claro, bloqueo tras 6 fallos, respeta modo QR_ONLY | ✅ | automática |
| Separación mínima entre checadas; empleado inactivo no checa; sucursal equivocada rechazada | ✅ | automática |
| Correcciones auditadas (anterior/nuevo/motivo/usuario; original intacto), alta manual, empalmes, horas locales por zona | ✅ | automática |
| Dashboard (estados, contadores), CSV con BOM y anti-fórmulas | ✅ | automática |
| **Aislamiento entre dos negocios** (listados, acceso por id → 404, correcciones, dispositivos, QR y PIN cruzados, CSV) | ✅ | automática |
| Límites de plan (empleados/sucursales) impuestos en backend | ✅ | automática |
| Suspensión: consulta y exporta sí; checa/edita no (402); reportar pago no activa; aprobar renueva una sola vez | ✅ | automática |
| Prueba vencida → gracia → suspendida; monto de pago fijado por el servidor | ✅ | automática |
| Panel SaaS: login separado, renovar, cortesía, bitácora, planes editables → reflejados en página pública, ingresos sin inventar, crear negocio | ✅ | automática |
| MFA TOTP del admin SaaS (contraseña sola no da acceso) | ✅ | automática |

Comprobado a mano en el navegador (Chrome embebido), contra API y BD reales:
- Sitio comercial (escritorio y móvil 375 px), planes leídos de la BD, build de producción de Next.js (standalone) sirviendo con proxy `/api`.
- Login del dueño demo, panel (escritorio y móvil con navegación inferior), reporte de asistencias (35 jornadas, 292:44 h, 7 retardos del demo).
- `/kiosko`: vinculación con código temporal, QR real rotando, reloj con zona de la sucursal, teclado PIN, barra de renovación, "Ana · 12:05" tras
  un escaneo real contra el API; el panel del dueño mostró "Trabajando ahora: 1".
- Panel SaaS: login y resumen (sin cifras simuladas).
- Reiniciar el API: datos y sesiones intactos.
- **Respaldo y restauración:** `scripts/backup.sh` + `scripts/restore.sh` → base nueva con los mismos conteos (empleados, jornadas, eventos, negocios, planes).

## Sin verificar (no afirmes que funciona hasta probarlo)

1. **Escaneo con la cámara de un celular real.** El código (`getUserMedia` + jsQR, manejo de permisos/errores) está escrito y compila, pero no se ha
   probado con una cámara ni con HTTPS real. Hay que probar en iPhone/Safari y Android/Chrome sobre HTTPS. El resto del flujo QR (token → escaneo → checada)
   sí se probó contra el API.
2. **Docker y Coolify.** Dockerfiles y `docker-compose.yml` escritos pero **nunca construidos ni ejecutados** (no hay Docker en el equipo de desarrollo).
3. **Envío de correo por SMTP.** Sólo se probó el modo sin SMTP (enlaces en el log). Falta configurar un proveedor real.
4. **HTTPS / cookies `Secure` en producción.**
5. **Pruebas de interfaz automatizadas** (Playwright): no existen. La UI se revisó manualmente.
6. Rendimiento bajo carga, accesibilidad auditada con herramienta y Lighthouse: no medidos.

## Pendiente / decisiones conscientes

- **Row Level Security** de PostgreSQL: **no implementada** (ver `docs/ARQUITECTURA.md`); el aislamiento es por aplicación + pruebas.
- **Limitador de intentos fallidos en memoria** (una instancia). Con varias réplicas debe pasar a Redis/PostgreSQL.
- **PWA:** sólo `manifest` e ícono (se puede agregar a la pantalla de inicio). No hay *service worker*: no hay modo offline (fuera del MVP).
- **Pasarela de pago:** fuera del MVP (pagos manuales con revisión del admin).
- **Textos legales** (privacidad y términos): plantillas razonables, **deben revisarse con un asesor legal** antes de vender.
- Marca provisional "ChecaFácil" configurable (`NEXT_PUBLIC_BRAND_NAME`, ajustes SaaS). Sin testimonios ni cifras inventadas:
  la sección de testimonios y el "Más de N negocios" sólo aparecen al llenar `apps/web/src/lib/testimonials.ts` con datos reales.
- Sitio comercial rediseñado (13-nov-2026): plan más económico como protagonista, capturas reales del sistema en
  `apps/web/public/capturas/` (cuenta demo), sección de la reforma LFT (registro electrónico de jornada, DOF 1-may-2026, exigible
  1-ene-2027). Revisado a mano en escritorio (1366 px) y móvil (375 px) en modo desarrollo; **el texto legal de la reforma debe
  validarlo un asesor** y no se ha vuelto a correr el build de producción.
- Cambio de plan por el cliente: sólo lo hace el administrador SaaS.
- Recuperación de contraseña de **empleados**: la gestiona el dueño reenviando la invitación (no hay "olvidé mi contraseña" de empleado).
- Un usuario tiene un solo negocio activo por sesión (el modelo ya admite varios).
- Seguridad: el admin SaaS recién sembrado puede enrolar su MFA con sólo la contraseña; hazlo en el primer ingreso (ver `docs/DESPLIEGUE.md`).

## Cómo reproducir la demostración comercial

1. `npx ts-node prisma/seed.ts --demo` (en `apps/api`) y arrancar API + web (ver README).
2. Sitio comercial `/` → `/registro` (crea un negocio real de prueba) → `/panel`.
3. En `/panel/empleados` agrega un empleado (guarda su PIN) → `/panel/configuracion` → **Vincular tableta** → en otro dispositivo abre `/kiosko` y escribe el código.
4. Invita al empleado con su correo (el enlace sale en el panel y en el log del API) → desde su celular `/empleado` → **Escanear QR**.
5. Mira la entrada en `/panel`, corrígela en `/panel/asistencias`, exporta CSV.
6. `/plataforma` (admin SaaS): renueva, aprueba pagos, edita precios.

## Mapa de criterios de aceptación

Del 1 al 27 del prompt original: cubiertos y probados por API/UI **excepto** el 12–13 en cámara real de celular (ver "Sin verificar"), el 25
(sin instalar programas: la arquitectura lo cumple; falta confirmarlo en dispositivos reales) y el 27 en Docker (probado con las herramientas de PostgreSQL, no con la pila Docker).
