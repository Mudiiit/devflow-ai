import { isSecureFrontendOrigin } from '../common/public-origin.js';

export const AUTH_ACCESS_TOKEN_COOKIE = 'devflow_access_token';
export const AUTH_REFRESH_TOKEN_COOKIE = 'devflow_refresh_token';
export const AUTH_CSRF_COOKIE = 'devflow_csrf_token';
export const AUTH_OAUTH_STATE_COOKIE = 'devflow_oauth_state';
export const AUTH_WEBHOOK_EVENT_HEADER = 'x-github-event';
export const AUTH_WEBHOOK_SIGNATURE_HEADER = 'x-hub-signature-256';
export const AUTH_CSRF_HEADER = 'x-csrf-token';
export const AUTH_BEARER_PREFIX = 'Bearer ';

export const AUTH_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const AUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const AUTH_COOKIE_PATH = '/';

export const resolveAuthCookieSameSite = (): 'lax' | 'none' => {
  return isSecureFrontendOrigin() ? 'none' : 'lax';
};
