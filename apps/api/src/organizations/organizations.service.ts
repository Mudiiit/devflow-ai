import { Injectable } from '@nestjs/common';
import {
  OrganizationMembershipsRepository,
  OrganizationsRepository,
  OrganizationSettingsRepository,
  UsersRepository,
  type Organization,
  type OrganizationMembership,
  type User,
} from '@devflow/database';

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
};

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationMembershipsRepository: OrganizationMembershipsRepository,
    private readonly organizationSettingsRepository: OrganizationSettingsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async ensurePersonalOrganizationForUser(input: { userId: string; githubLogin: string; displayName?: string | null }) {
    const memberships = await this.organizationMembershipsRepository.findManyByUserId(input.userId);
    if (memberships.length > 0) {
      const organization = await this.organizationsRepository.findById(memberships[0]!.organizationId);
      return organization ?? null;
    }

    const baseSlug = slugify(input.githubLogin) || `user-${input.userId.slice(0, 6)}`;
    const slug = await this.ensureUniqueSlug(baseSlug);
    const name = input.displayName ? `${input.displayName} Workspace` : `${input.githubLogin} Workspace`;

    const organization = await this.organizationsRepository.upsertBySlug({
      name,
      slug,
      ownerUserId: input.userId,
      createdByUserId: input.userId,
      status: 'active',
      plan: 'free',
    });

    await this.organizationMembershipsRepository.upsertMembership({
      organizationId: organization.id,
      userId: input.userId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    await this.organizationSettingsRepository.upsertForOrganization({
      organizationId: organization.id,
      aiProvider: null,
      aiModel: null,
      reviewStrictness: 50,
      autoReviewEnabled: true,
      notificationPreferences: {},
      repositoryRules: {},
      githubPreferences: {},
      securityContacts: null,
      metadata: {
        seededFrom: 'oauth',
      },
    });

    return organization;
  }

  async ensureOrganizationForGithubAccount(input: { accountLogin: string; ownerUserId?: string | null }) {
    const slugBase = slugify(input.accountLogin) || `org-${Date.now()}`;
    let organization = await this.organizationsRepository.findBySlug(slugBase);

    if (!organization) {
      const slug = await this.ensureUniqueSlug(slugBase);
      organization = await this.organizationsRepository.upsertBySlug({
        name: input.accountLogin,
        slug,
        ownerUserId: input.ownerUserId ?? null,
        createdByUserId: input.ownerUserId ?? null,
        status: 'active',
        plan: 'free',
      });
    }

    if (input.ownerUserId) {
      await this.organizationMembershipsRepository.upsertMembership({
        organizationId: organization.id,
        userId: input.ownerUserId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      });
    }

    return organization;
  }

  async listOrganizationsForUser(userId: string) {
    const memberships = await this.organizationMembershipsRepository.findManyByUserId(userId);
    const organizations = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        organization: await this.organizationsRepository.findById(membership.organizationId),
      })),
    );

    return organizations
      .filter((entry): entry is { membership: OrganizationMembership; organization: Organization } => Boolean(entry.organization))
      .map((entry) => ({
        membership: entry.membership,
        organization: entry.organization,
      }));
  }

  async getOrganizationById(organizationId: string) {
    return this.organizationsRepository.findById(organizationId);
  }

  async listOrganizationMembers(organizationId: string) {
    const memberships = await this.organizationMembershipsRepository.findManyByOrganizationId(organizationId);
    const members = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        user: await this.usersRepository.findById(membership.userId),
      })),
    );

    return members.map((entry) => ({
      membership: entry.membership,
      user: entry.user,
    }));
  }

  async upsertOrganizationMember(organizationId: string, userId: string, role: User['role']) {
    return this.organizationMembershipsRepository.upsertMembership({
      organizationId,
      userId,
      role,
      status: 'active',
      joinedAt: new Date(),
    });
  }

  async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let candidate = baseSlug;
    let counter = 0;

    while (await this.organizationsRepository.findBySlug(candidate)) {
      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }

    return candidate;
  }
}
