import type { User } from '@devflow/database';

export type AppRole = User['role'];

export const roleHierarchy: Record<AppRole, number> = {
  owner: 100,
  admin: 80,
  maintainer: 60,
  reviewer: 40,
  member: 20,
};

export type AppPermission =
  | 'organization.manage'
  | 'organization.members.manage'
  | 'repository.read'
  | 'repository.manage'
  | 'review.read'
  | 'review.write'
  | 'settings.manage'
  | 'billing.read'
  | 'billing.manage'
  | 'api_keys.manage'
  | 'secrets.manage'
  | 'analytics.read'
  | 'admin.analytics.read';

const permissionsByRole: Record<AppRole, ReadonlySet<AppPermission>> = {
  owner: new Set<AppPermission>([
    'organization.manage',
    'organization.members.manage',
    'repository.read',
    'repository.manage',
    'review.read',
    'review.write',
    'settings.manage',
    'billing.read',
    'billing.manage',
    'api_keys.manage',
    'secrets.manage',
    'analytics.read',
    'admin.analytics.read',
  ]),
  admin: new Set<AppPermission>([
    'organization.members.manage',
    'repository.read',
    'repository.manage',
    'review.read',
    'review.write',
    'settings.manage',
    'billing.read',
    'billing.manage',
    'api_keys.manage',
    'secrets.manage',
    'analytics.read',
    'admin.analytics.read',
  ]),
  maintainer: new Set<AppPermission>([
    'repository.read',
    'repository.manage',
    'review.read',
    'review.write',
    'settings.manage',
    'billing.read',
    'api_keys.manage',
    'secrets.manage',
    'analytics.read',
  ]),
  reviewer: new Set<AppPermission>([
    'repository.read',
    'review.read',
    'review.write',
    'analytics.read',
  ]),
  member: new Set<AppPermission>([
    'repository.read',
    'review.read',
    'analytics.read',
  ]),
};

export const hasRoleAtLeast = (currentRole: AppRole, minimumRole: AppRole): boolean => {
  return roleHierarchy[currentRole] >= roleHierarchy[minimumRole];
};

export const hasPermission = (role: AppRole, permission: AppPermission): boolean => {
  return permissionsByRole[role].has(permission);
};

export const resolvePermissions = (role: AppRole): ReadonlyArray<AppPermission> => {
  return [...permissionsByRole[role]];
};
