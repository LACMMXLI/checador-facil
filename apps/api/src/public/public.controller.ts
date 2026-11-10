import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BillingService } from '../billing/billing.service';

/** Datos públicos para la página comercial. Nunca expone información de clientes. */
@Controller('public')
export class PublicController {
  constructor(private prisma: PrismaService, private billing: BillingService) {}

  @Get('plans')
  async plans() {
    const plans = await this.prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    return plans.map((p) => ({
      code: p.code, name: p.name, description: p.description, priceMonthlyCents: p.priceMonthlyCents, currency: p.currency,
      maxEmployees: p.maxEmployees, maxBranches: p.maxBranches, trialDays: p.trialDays, historyDays: p.historyDays, canExport: p.canExport,
      features: p.features, highlighted: p.highlighted,
    }));
  }

  @Get('config')
  async config() {
    const s = await this.billing.getAllSettings();
    return { brandName: s.brand_name, contactEmail: s.contact_email, contactWhatsapp: s.contact_whatsapp };
  }
}
