import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: Array<'owner' | 'admin' | 'reviewer' | 'member'>) => SetMetadata(ROLES_KEY, roles);