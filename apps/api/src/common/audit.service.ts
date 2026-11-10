import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(p: {
    tenantId?: string | null; actorType: string; actorId?: string | null; action: string;
    entity?: string; entityId?: string; data?: Prisma.InputJsonValue;
  }, tx?: Prisma.TransactionClient) {
    await (tx ?? this.prisma).auditLog.create({ data: { ...p, tenantId: p.tenantId ?? null, actorId: p.actorId ?? null } });
  }
}
