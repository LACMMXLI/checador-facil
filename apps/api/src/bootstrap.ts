import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Configuración común a producción y pruebas. */
export function configureApp(app: INestApplication) {
  const exp = app as NestExpressApplication;
  exp.set('trust proxy', 1); // detrás de Coolify/Traefik: IP real del cliente para límites
  exp.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  return app;
}
