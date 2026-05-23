import { eq } from 'drizzle-orm';
import { organizationSettings } from '../schema/organization-settings.js';
import type { NewOrganizationSettings } from '../schema/organization-settings.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class OrganizationSettingsRepository extends BaseRepository<typeof organizationSettings> {
  constructor(db: DatabaseClient) {
    super(db, organizationSettings, organizationSettings.id);
  }

  async findByOrganizationId(organizationId: string) {
    const rows = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertForOrganization(input: NewOrganizationSettings) {
    const existing = await this.findByOrganizationId(input.organizationId);

    if (existing) {
      const rows = await this.db
        .update(organizationSettings)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return rows[0] ?? existing;
    }

    const rows = await this.db.insert(organizationSettings).values(input).returning();

    return rows[0]!;
  }
}
