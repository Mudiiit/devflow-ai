import { serverEnv } from '@devflow/config/server';
import { isIP } from 'node:net';

const localFrontendOrigin = 'http://127.0.0.1:3000';

export function resolveFrontendOrigin(): string {
  const configuredOrigin =
    serverEnv.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  return localFrontendOrigin;
}

export function resolveApiOrigin(): string {
  const configuredOrigin =
    process.env.RENDER_EXTERNAL_URL ??
    process.env.API_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_API_URL;

  if (configuredOrigin && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, '');
  }

  const port = process.env.PORT ?? '4000';

  return `http://127.0.0.1:${port}`;
}

export function isSecureFrontendOrigin(): boolean {
  return resolveFrontendOrigin().startsWith('https://');
}

function getHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isIP(hostname) !== 0
  );
}

export function resolveSharedCookieDomain(): string | undefined {
  const frontendHost = getHostname(resolveFrontendOrigin());
  const apiHost = getHostname(resolveApiOrigin());

  if (!frontendHost || !apiHost || frontendHost === apiHost) {
    return undefined;
  }

  if (isLocalHostname(frontendHost) || isLocalHostname(apiHost)) {
    return undefined;
  }

  const frontendLabels = frontendHost.split('.');
  const apiLabels = apiHost.split('.');
  const sharedLabels: string[] = [];

  while (frontendLabels.length > 0 && apiLabels.length > 0) {
    const frontendLabel = frontendLabels[frontendLabels.length - 1];
    const apiLabel = apiLabels[apiLabels.length - 1];

    if (frontendLabel !== apiLabel) {
      break;
    }

    sharedLabels.unshift(frontendLabels.pop()!);
    apiLabels.pop();
  }

  if (sharedLabels.length < 2) {
    return undefined;
  }

  return sharedLabels.join('.');
}
