import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Configuración común a producción y pruebas. */
export function configureApp(app: INestApplication) {
  const exp = app as NestExpressApplication;
  // Saltos de proxy de confianza para obtener la IP real del cliente (límites de intentos).
  // Coolify: Traefik → web (Next reenvía /api) → api = 2 saltos. Directo detrás de un solo proxy = 1.
  exp.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  exp.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  return app;
}
