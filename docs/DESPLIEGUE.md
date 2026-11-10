# Despliegue

> **Aviso honesto:** las imágenes Docker y el despliegue en Coolify **no se han ejecutado todavía** (el equipo de desarrollo no tenía Docker).
> Los Dockerfiles y el `docker-compose.yml` están escritos siguiendo la configuración que sí se probó (build de producción de Next.js en modo
> standalone, API compilada con Nest, migraciones con Prisma). Haz el primer despliegue en un entorno de prueba y revisa los logs.

## 1. Requisitos

- Un servidor Linux con Docker y Docker Compose (o Coolify ya instalado).
- Un dominio apuntando al servidor. **HTTPS es obligatorio**: la cámara del celular sólo se puede usar en HTTPS, y las cookies son `Secure`.
- (Recomendado) Un servicio SMTP para verificación de correo, recuperación de contraseña e invitaciones.

## 2. Con Docker Compose

```bash
git clone <tu-repo> reloj && cd reloj
cp .env.example .env     # edita TODAS las claves y APP_URL
docker compose up -d --build
docker compose logs -f api        # verás: migraciones aplicadas + seed de planes/admin
```

- Publica sólo `web` (puerto `WEB_PORT`). Pon delante un proxy con HTTPS (Caddy, Traefik, Nginx o Coolify).
- La web reenvía `/api/*` al contenedor `api` por la red interna; el API **no** se expone.
- Si tu proxy ya enruta `/api` directo al API, también funciona (las rutas del API viven bajo `/api`).

Ejemplo de Caddy:

```
tudominio.com {
  reverse_proxy localhost:3000
}
```

## 3. Con Coolify

1. DNS: crea un registro `A` de `tudominio.com` hacia la IP del servidor.
2. **Projects → New Resource → Public/Private Repository (Git)** con `https://github.com/LACMMXLI/checador-facil`, rama `main`,
   *Build Pack* = **Docker Compose**, archivo `/docker-compose.yml`. (Repo privado: agrega una *Deploy Key* o la app de GitHub en Coolify.)
3. **Environment Variables:** carga las de `.env.example` (sección producción). Obligatorias: `POSTGRES_PASSWORD`, `APP_URL`, `APP_SECRET`,
   `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`. Genera `APP_SECRET` con `openssl rand -hex 32`.
4. En el servicio **web** pon el dominio `https://tudominio.com:3000` (el `:3000` es el puerto interno). **No** asignes dominio a `api`, `db` ni `backup`.
5. Deploy. Revisa primero los logs de `api` (migraciones + seed) y luego abre el dominio.
6. Cambiar `APP_URL` o `NEXT_PUBLIC_BRAND_NAME` requiere **reconstruir** `web` (se incorporan en el build). Si tras desplegar el sitemap o las
   etiquetas Open Graph muestran `localhost`, Coolify no pasó la variable al build: en el servicio web marca `NEXT_PUBLIC_SITE_URL`/`APP_URL` como *Build Variable*.
7. `TRUST_PROXY_HOPS=2` (ya por defecto en el compose) es necesario: Traefik → web → api. Con otro valor, todos los clientes compartirían IP en los límites de intentos.

## 4. Primer arranque

1. El API aplica las migraciones (`prisma migrate deploy`) y siembra los **planes** y el **admin SaaS** (sólo si no existen).
2. Entra a `https://tudominio.com/plataforma/login` con `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.
3. Con `PLATFORM_REQUIRE_MFA=true` se te pedirá escanear un QR con una app de autenticación. **Hazlo de inmediato**: mientras el admin no
   active su MFA, quien conozca la contraseña podría registrar su propio autenticador.
4. En **Ajustes** escribe tus instrucciones de pago y datos de contacto. En **Planes** ajusta precios y límites.
5. Quita `PLATFORM_ADMIN_PASSWORD` del entorno cuando ya no la necesites.

## 5. Respaldos y restauración

El servicio `backup` hace un `pg_dump -Fc` diario al volumen `backups` y conserva `BACKUP_KEEP_DAYS` días.

```bash
# Respaldo manual inmediato
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/manual_$(date +%F_%H%M).dump'
# Copiarlo fuera del servidor (hazlo a otro lugar: un respaldo en el mismo disco no te protege de perder el disco)
docker compose cp backup:/backups/manual_XXXX.dump ./

# Restaurar (esto REEMPLAZA los datos actuales)
docker compose stop api web
docker compose cp ./manual_XXXX.dump db:/tmp/r.dump
docker compose exec db pg_restore -U reloj -d reloj_saas --clean --if-exists --no-owner /tmp/r.dump
docker compose start api web
```

`scripts/backup.sh` y `scripts/restore.sh` hacen lo mismo contra cualquier `DATABASE_URL` (se probaron con PostgreSQL 18 en Windows:
respaldo → restauración en otra base → mismos conteos de empleados, jornadas, eventos, negocios y planes).

**Recomendación:** programa la copia de `/backups` a almacenamiento externo (rclone, S3, etc.) y prueba la restauración periódicamente.

## 6. Reinicios y actualizaciones

- Los datos viven en el volumen `pgdata`; reiniciar o reconstruir `api`/`web` no los toca (se probó reiniciando el API: datos y sesiones intactos).
- Actualizar: `git pull && docker compose up -d --build`. Las migraciones se aplican solas al arrancar el API.
- **Nunca** cambies `APP_SECRET` con datos existentes: invalidaría todos los PIN (el índice de PIN se deriva de él).

## 7. Escalar más allá de una instancia

El API es *stateless* salvo el limitador de intentos fallidos (login/PIN), que vive en memoria del proceso. Con varias réplicas, cada una
llevaría su propio contador; para ese caso mueve `FailLimiter` a Redis o PostgreSQL. Para el volumen de un MVP (una instancia) no hace falta.
