import { SetMetadata } from '@nestjs/common';

export type ApiScope =
  | 'reviews:read'
  | 'reviews:write'
  | 'repositories:read'
  | 'repositories:write'
  | 'settings:read'
  | 'settings:write'
  | 'analytics:read';

export const API_SCOPES_KEY = 'auth:api-scopes';
export const ApiScopes = (...scopes: ApiScope[]) => SetMetadata(API_SCOPES_KEY, scopes);
