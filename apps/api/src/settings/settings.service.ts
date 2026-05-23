import { Inject, Injectable } from '@nestjs/common';
import {
  organizationSettings,
  repositorySettings,
  repositories,
  type DatabaseClient,
} from '@devflow/database';
import { and, eq } from '@devflow/database';
import { DATABASE_CLIENT } from '../database/database.constants.js';

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
};

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async getOrganizationSettings(organizationId: string) {
    const rows = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    return { settings: rows[0] ?? null };
  }

  async updateOrganizationSettings(organizationId: string, payload: Record<string, unknown>) {
    const patch = this.toOrganizationSettingsPatch(payload);
    const existing = await this.getOrganizationSettings(organizationId);

    if (existing.settings) {
      const rows = await this.db
        .update(organizationSettings)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.settings.id))
        .returning();

      return { settings: rows[0] ?? existing.settings };
    }

    const rows = await this.db
      .insert(organizationSettings)
      .values({
        organizationId,
        ...patch,
      })
      .returning();

    return { settings: rows[0] ?? null };
  }

  async getRepositorySettings(organizationId: string) {
    const rows = await this.db
      .select({
        settings: repositorySettings,
        repository: repositories,
      })
      .from(repositorySettings)
      .innerJoin(repositories, eq(repositorySettings.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId));

    return {
      settings: rows.map((row) => ({
        ...row.settings,
        repository: row.repository,
      })),
    };
  }

  async updateRepositorySettings(organizationId: string, repositoryId: string, payload: Record<string, unknown>) {
    const patch = this.toRepositorySettingsPatch(payload);
    const rows = await this.db
      .select()
      .from(repositories)
      .where(and(eq(repositories.organizationId, organizationId), eq(repositories.id, repositoryId)))
      .limit(1);

    if (!rows[0]) {
      return { settings: null };
    }

    const existing = await this.db
      .select()
      .from(repositorySettings)
      .where(eq(repositorySettings.repositoryId, repositoryId))
      .limit(1);

    if (existing[0]) {
      const updated = await this.db
        .update(repositorySettings)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(repositorySettings.id, existing[0].id))
        .returning();

      return { settings: updated[0] ?? existing[0] };
    }

    const inserted = await this.db
      .insert(repositorySettings)
      .values({
        organizationId,
        repositoryId,
        ...patch,
      })
      .returning();

    return { settings: inserted[0] ?? null };
  }

  private toOrganizationSettingsPatch(payload: Record<string, unknown>): Partial<typeof organizationSettings.$inferInsert> {
    return {
      aiProvider: typeof payload.aiProvider === 'string' ? payload.aiProvider : undefined,
      aiModel: typeof payload.aiModel === 'string' ? payload.aiModel : undefined,
      reviewStrictness: typeof payload.reviewStrictness === 'number' ? payload.reviewStrictness : undefined,
      autoReviewEnabled: typeof payload.autoReviewEnabled === 'boolean' ? payload.autoReviewEnabled : undefined,
      notificationPreferences: asRecord(payload.notificationPreferences),
      repositoryRules: asRecord(payload.repositoryRules),
      githubPreferences: asRecord(payload.githubPreferences),
      securityContacts: typeof payload.securityContacts === 'string' ? payload.securityContacts : undefined,
      metadata: asRecord(payload.metadata),
    };
  }

  private toRepositorySettingsPatch(payload: Record<string, unknown>): Partial<typeof repositorySettings.$inferInsert> {
    return {
      reviewStrictness: typeof payload.reviewStrictness === 'number' ? payload.reviewStrictness : undefined,
      autoReviewEnabled: typeof payload.autoReviewEnabled === 'boolean' ? payload.autoReviewEnabled : undefined,
      fileFilters: asRecord(payload.fileFilters),
      notificationPreferences: asRecord(payload.notificationPreferences),
      metadata: asRecord(payload.metadata),
    };
  }
}
