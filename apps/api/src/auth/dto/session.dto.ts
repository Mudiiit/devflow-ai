import type { AuthenticatedUser } from '../auth.types.js';

export interface AuthSessionDto {
  user: AuthenticatedUser;
  sessionId: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

export interface AuthLoginResponseDto extends AuthSessionDto {
  csrfToken: string;
}
