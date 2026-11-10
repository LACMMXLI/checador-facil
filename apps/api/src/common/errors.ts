import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
export const unauthorized = (msg = 'Inicia sesión para continuar.', code = 'UNAUTHORIZED') => new AppError(401, code, msg);
export const forbidden = (msg = 'No tienes permiso para hacer esto.', code = 'FORBIDDEN') => new AppError(403, code, msg);
export const notFound = (msg = 'No encontramos lo que buscas.', code = 'NOT_FOUND') => new AppError(404, code, msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooMany = (msg = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.') => new AppError(429, 'TOO_MANY', msg);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private log = new Logger('Errors');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    if (e instanceof AppError) return res.status(e.status).json({ error: { code: e.code, message: e.message } });
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return res.status(400).json({ error: { code: 'VALIDATION', message: first?.message || 'Revisa los datos e inténtalo de nuevo.', field: first?.path?.join('.') } });
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      if (status === 429) return res.status(429).json({ error: { code: 'TOO_MANY', message: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' } });
      if (status === 404) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas.' } });
      return res.status(status).json({ error: { code: 'ERROR', message: 'No pudimos completar la acción. Inténtalo nuevamente.' } });
    }
    this.log.error(`${req.method} ${req.url}: ${(e as Error)?.stack || e}`);
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Algo salió mal de nuestro lado. Inténtalo nuevamente en unos minutos.' } });
  }
}
