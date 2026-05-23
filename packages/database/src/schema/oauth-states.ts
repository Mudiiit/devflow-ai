import { index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { authProviderEnum, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';

export const oauthStates = pgTable(
  'oauth_states',
  {
    id: createIdColumn(),
    provider: authProviderEnum('provider').notNull().default('github'),
    stateHash: varchar('state_hash', { length: 128 }).notNull(),
    returnTo: text('return_to'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    stateHashIdx: uniqueIndex('oauth_states_state_hash_unique_idx').on(table.stateHash),
    providerIdx: index('oauth_states_provider_idx').on(table.provider),
    expiresAtIdx: index('oauth_states_expires_at_idx').on(table.expiresAt),
  }),
);

export type OauthState = typeof oauthStates.$inferSelect;
export type NewOauthState = typeof oauthStates.$inferInsert;