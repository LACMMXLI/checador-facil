import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { AuditService } from './common/audit.service';
import { MailService } from './common/mail.service';
import { FailLimiter } from './common/rate-limiter';
import { AllExceptionsFilter } from './common/errors';
import { BillingService } from './billing/billing.service';
import { AttendanceService } from './attendance/attendance.service';
import { SessionService } from './auth/session.service';
import { AccessGuard, CsrfGuard } from './auth/guards';
import { AuthController } from './auth/auth.controller';
import { OwnerController } from './owner/owner.controller';
import { KioskController } from './kiosk/kiosk.controller';
import { EmployeeController } from './kiosk/employee.controller';
import { PlatformController } from './platform/platform.controller';
import { PublicController } from './public/public.controller';

@Controller('health')
class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 240 }], skipIf: () => process.env.NODE_ENV === 'test' })],
  controllers: [HealthController, AuthController, OwnerController, KioskController, EmployeeController, PlatformController, PublicController],
  providers: [
    PrismaService, AuditService, MailService, FailLimiter, BillingService, AttendanceService, SessionService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
