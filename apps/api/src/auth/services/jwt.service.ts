import { Injectable } from '@nestjs/common';
import { serverEnv } from '@devflow/config/server';
import { AUTH_ACCESS_TOKEN_TTL_SECONDS } from '../auth.constants.js';
import { type JwtAccessTokenPayload } from '../auth.types.js';
import { signJwt, verifyJwt } from '../utils/crypto.js';
import {
  resolveApiOrigin,
  resolveFrontendOrigin,
} from '../../common/public-origin.js';

@Injectable()
export class JwtService {
  private readonly issuer = resolveApiOrigin();
  private readonly audience = resolveFrontendOrigin();

  signAccessToken(
    payload: Omit<JwtAccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
  ): string {
    return signJwt(
      payload,
      serverEnv.JWT_SECRET,
      AUTH_ACCESS_TOKEN_TTL_SECONDS,
      this.issuer,
      this.audience,
    );
  }

  verifyAccessToken(token: string): JwtAccessTokenPayload | null {
    return verifyJwt<JwtAccessTokenPayload>(
      token,
      serverEnv.JWT_SECRET,
      this.issuer,
      this.audience,
    );
  }
}
