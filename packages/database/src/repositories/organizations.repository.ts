import { eq } from 'drizzle-orm';
import { organizations } from '../schema/organizations.js';
import type { NewOrganization } from '../schema/organizations.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class OrganizationsRepository extends BaseRepository<typeof organizations> {
  constructor(db: DatabaseClient) {
    super(db, organizations, organizations.id);
  }

  async findBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertBySlug(input: NewOrganization) {
    const rows = await this.db
      .insert(organizations)
      .values(input)
      .onConflictDoUpdate({
        target: organizations.slug,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}
