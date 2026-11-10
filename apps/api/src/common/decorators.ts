import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestCtx } from '../auth/guards';

export const Ctx = createParamDecorator((_d: unknown, ec: ExecutionContext): RequestCtx => ec.switchToHttp().getRequest().ctx || {});
export const ClientIp = createParamDecorator((_d: unknown, ec: ExecutionContext): string => ec.switchToHttp().getRequest().ip || 'unknown');
export const UserAgent = createParamDecorator((_d: unknown, ec: ExecutionContext): string => String(ec.switchToHttp().getRequest().headers['user-agent'] || ''));
