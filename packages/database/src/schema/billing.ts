import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import {
  billingCadences,
  billingInvoiceStatuses,
  billingProviderNames,
  billingSubscriptionStatuses,
  billingUsageResources,
  billingUsageSources,
  billingUsageUnits,
  type BillingPlanQuota,
} from '@devflow/billing';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';

const billingProviderValues = billingProviderNames as unknown as [string, ...string[]];
const billingCadenceValues = billingCadences as unknown as [string, ...string[]];
const billingSubscriptionStatusValues = billingSubscriptionStatuses as unknown as [string, ...string[]];
const billingInvoiceStatusValues = billingInvoiceStatuses as unknown as [string, ...string[]];
const billingUsageResourceValues = billingUsageResources as unknown as [string, ...string[]];
const billingUsageUnitValues = billingUsageUnits as unknown as [string, ...string[]];
const billingUsageSourceValues = billingUsageSources as unknown as [string, ...string[]];

export const billingProviderEnum = pgEnum('billing_provider', billingProviderValues);
export const billingCadenceEnum = pgEnum('billing_cadence', billingCadenceValues);
export const billingSubscriptionStatusEnum = pgEnum('billing_subscription_status', billingSubscriptionStatusValues);
export const billingInvoiceStatusEnum = pgEnum('billing_invoice_status', billingInvoiceStatusValues);
export const billingUsageResourceEnum = pgEnum('billing_usage_resource', billingUsageResourceValues);
export const billingUsageUnitEnum = pgEnum('billing_usage_unit', billingUsageUnitValues);
export const billingUsageSourceEnum = pgEnum('billing_usage_source', billingUsageSourceValues);

export const billingCustomers = pgTable(
  'billing_customers',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    provider: billingProviderEnum('provider').notNull().default('manual'),
    providerCustomerId: varchar('provider_customer_id', { length: 255 }),
    email: varchar('email', { length: 320 }),
    name: varchar('name', { length: 255 }),
    currency: varchar('currency', { length: 8 }).notNull().default('usd'),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: uniqueIndex('billing_customers_organization_id_unique_idx').on(table.organizationId),
    providerCustomerIdx: index('billing_customers_provider_customer_id_idx').on(table.providerCustomerId),
  }),
);

export const pricingPlans = pgTable(
  'pricing_plans',
  {
    id: createIdColumn(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    provider: billingProviderEnum('provider').notNull().default('manual'),
    providerProductId: varchar('provider_product_id', { length: 255 }),
    providerPriceId: varchar('provider_price_id', { length: 255 }),
    cadence: billingCadenceEnum('cadence').notNull().default('monthly'),
    currency: varchar('currency', { length: 8 }).notNull().default('usd'),
    monthlyPriceCents: integer('monthly_price_cents').notNull().default(0),
    annualPriceCents: integer('annual_price_cents').notNull().default(0),
    quotaRules: jsonb('quota_rules').$type<readonly BillingPlanQuota[]>().notNull().default(sql`'[]'::jsonb`),
    featured: boolean('featured').notNull().default(false),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    codeIdx: uniqueIndex('pricing_plans_code_unique_idx').on(table.code),
    activeIdx: index('pricing_plans_active_idx').on(table.active),
    providerIdx: index('pricing_plans_provider_idx').on(table.provider),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    billingCustomerId: createForeignIdColumn('billing_customer_id').references(() => billingCustomers.id, { onDelete: 'set null' }),
    pricingPlanId: createForeignIdColumn('pricing_plan_id').references(() => pricingPlans.id, { onDelete: 'set null' }),
    provider: billingProviderEnum('provider').notNull().default('manual'),
    providerSubscriptionId: varchar('provider_subscription_id', { length: 255 }),
    status: billingSubscriptionStatusEnum('status').notNull().default('trialing'),
    cadence: billingCadenceEnum('cadence').notNull().default('monthly'),
    quantitySeats: integer('quantity_seats').notNull().default(1),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true, mode: 'date' }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: uniqueIndex('subscriptions_organization_id_unique_idx').on(table.organizationId),
    providerSubscriptionIdx: uniqueIndex('subscriptions_provider_subscription_id_unique_idx').on(table.providerSubscriptionId),
    statusIdx: index('subscriptions_status_idx').on(table.status),
    providerIdx: index('subscriptions_provider_idx').on(table.provider),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    billingCustomerId: createForeignIdColumn('billing_customer_id').references(() => billingCustomers.id, { onDelete: 'set null' }),
    subscriptionId: createForeignIdColumn('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    provider: billingProviderEnum('provider').notNull().default('manual'),
    providerInvoiceId: varchar('provider_invoice_id', { length: 255 }),
    invoiceNumber: varchar('invoice_number', { length: 128 }).notNull(),
    status: billingInvoiceStatusEnum('status').notNull().default('draft'),
    currency: varchar('currency', { length: 8 }).notNull().default('usd'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    amountDueCents: integer('amount_due_cents').notNull().default(0),
    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'date' }),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    invoicePdfUrl: text('invoice_pdf_url'),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: index('invoices_organization_id_idx').on(table.organizationId),
    providerInvoiceIdx: uniqueIndex('invoices_provider_invoice_id_unique_idx').on(table.providerInvoiceId),
    providerIdx: index('invoices_provider_idx').on(table.provider),
    statusIdx: index('invoices_status_idx').on(table.status),
  }),
);

export const usageRecords = pgTable(
  'usage_records',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    billingCustomerId: createForeignIdColumn('billing_customer_id').references(() => billingCustomers.id, { onDelete: 'set null' }),
    subscriptionId: createForeignIdColumn('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    pricingPlanId: createForeignIdColumn('pricing_plan_id').references(() => pricingPlans.id, { onDelete: 'set null' }),
    resource: billingUsageResourceEnum('resource').notNull(),
    quantity: integer('quantity').notNull().default(0),
    unit: billingUsageUnitEnum('unit').notNull().default('count'),
    source: billingUsageSourceEnum('source').notNull().default('system'),
    relatedEntityType: varchar('related_entity_type', { length: 64 }),
    relatedEntityId: varchar('related_entity_id', { length: 255 }),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: index('usage_records_organization_id_idx').on(table.organizationId),
    resourceIdx: index('usage_records_resource_idx').on(table.resource),
    sourceIdx: index('usage_records_source_idx').on(table.source),
    recordedAtIdx: index('usage_records_recorded_at_idx').on(table.recordedAt),
  }),
);

export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type NewBillingCustomer = typeof billingCustomers.$inferInsert;

export type PricingPlan = typeof pricingPlans.$inferSelect;
export type NewPricingPlan = typeof pricingPlans.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;