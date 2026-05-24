import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '../rbac.types.js';

export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);