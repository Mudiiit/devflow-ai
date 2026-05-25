import { serverEnv } from '@devflow/config';

const localFrontendOrigin = 'http://127.0.0.1:3000';

export function resolveFrontendOrigin(): string {
  const configuredOrigin = serverEnv.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_URL or NEXT_PUBLIC_APP_URL is required in production');
  }

  return localFrontendOrigin;
}

export function resolveApiOrigin(): string {
  const configuredOrigin = process.env.RENDER_EXTERNAL_URL ?? process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('RENDER_EXTERNAL_URL, API_PUBLIC_URL, or NEXT_PUBLIC_API_URL is required in production');
  }

  const port = process.env.PORT ?? '4000';

  return `http://127.0.0.1:${port}`;
}

export function isSecureFrontendOrigin(): boolean {
  return resolveFrontendOrigin().startsWith('https://');
}