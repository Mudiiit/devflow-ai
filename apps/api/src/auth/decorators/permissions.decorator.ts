import { SetMetadata } from '@nestjs/common';
import type { AppPermission } from '../rbac.types.js';

export const PERMISSIONS_KEY = 'auth:permissions';
export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
