import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard.js';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator.js';
import { BillingService } from './billing.service.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  async getSubscription(@CurrentOrganization() organization: { id: string }) {
    return this.billingService.getCurrentSubscription(organization.id);
  }

  @Get('usage')
  async getUsage(@CurrentOrganization() organization: { id: string }) {
    return this.billingService.getUsageStatistics(organization.id);
  }

  @Get('history')
  async getHistory(@CurrentOrganization() organization: { id: string }) {
    return this.billingService.getBillingHistory(organization.id);
  }

  @Get('plans')
  async getPlans() {
    return { plans: await this.billingService.getPricingPlans() };
  }

  @Post('checkout')
  async createCheckout(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { planCode: string; cadence?: 'monthly' | 'annual'; successUrl?: string; cancelUrl?: string },
  ) {
    return this.billingService.createCheckoutSession(organization.id, body);
  }

  @Post('subscription/change')
  async changeSubscription(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { planCode: string; cadence?: 'monthly' | 'annual'; successUrl?: string; cancelUrl?: string },
  ) {
    return this.billingService.changeSubscription(organization.id, body);
  }

  @Post('portal')
  async createPortal(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { returnUrl?: string },
  ) {
    return this.billingService.createPortalSession(organization.id, body.returnUrl);
  }

  @Post('webhook')
  async webhook(@Body() body: Record<string, unknown>) {
    return this.billingService.handleWebhook(body);
  }
}