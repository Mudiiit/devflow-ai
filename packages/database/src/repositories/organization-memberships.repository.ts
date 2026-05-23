import { and, eq } from 'drizzle-orm';
import { organizationMemberships } from '../schema/organization-memberships.js';
import type { NewOrganizationMembership } from '../schema/organization-memberships.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class OrganizationMembershipsRepository extends BaseRepository<typeof organizationMemberships> {
  constructor(db: DatabaseClient) {
    super(db, organizationMemberships, organizationMemberships.id);
  }

  async findByOrganizationAndUser(organizationId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId)))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByUserId(userId: string) {
    return this.db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, userId));
  }

  async findManyByOrganizationId(organizationId: string) {
    return this.db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, organizationId));
  }

  async upsertMembership(input: NewOrganizationMembership) {
    const rows = await this.db
      .insert(organizationMemberships)
      .values(input)
      .onConflictDoUpdate({
        target: [organizationMemberships.organizationId, organizationMemberships.userId],
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}
