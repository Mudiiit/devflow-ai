import { serverEnv } from '@devflow/config';

const localFrontendOrigin = 'http://127.0.0.1:3000';

export function resolveFrontendOrigin(): string {
  const configuredOrigin = serverEnv.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  return localFrontendOrigin;
}

export function resolveApiOrigin(): string {
  const configuredOrigin = process.env.RENDER_EXTERNAL_URL ?? process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  const port = process.env.PORT ?? '4000';

  return `http://127.0.0.1:${port}`;
}

export function isSecureFrontendOrigin(): boolean {
  return resolveFrontendOrigin().startsWith('https://');
}