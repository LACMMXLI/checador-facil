import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { assertConfig, config } from './common/config';

async function main() {
  assertConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API escuchando en el puerto ${config.port} (/api)`);
}
main();
