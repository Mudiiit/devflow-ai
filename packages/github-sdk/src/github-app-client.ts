import { createPrivateKey, createSign } from 'node:crypto';
import type { GitHubAppCredentials, GitHubInstallationAccessToken } from './types.js';

interface GitHubAppTokenResponse {
  readonly token: string;
  readonly expires_at: string;
}

const base64Url = (value: Buffer | string): string => {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const createJwt = (appId: string, privateKey: string): string => {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();

  const signature = signer.sign(createPrivateKey(privateKey));
  return `${header}.${payload}.${base64Url(signature)}`;
};

export class GitHubAppClient {
  private readonly apiBase = 'https://api.github.com';

  public constructor(private readonly credentials: GitHubAppCredentials) {}

  public async createInstallationAccessToken(installationId: number): Promise<GitHubInstallationAccessToken> {
    const response = await fetch(`${this.apiBase}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: this.buildHeaders({ authorization: `Bearer ${createJwt(this.credentials.appId, this.credentials.privateKey)}` }),
    });

    if (!response.ok) {
      throw new Error(`GitHub installation token request failed with status ${response.status}`);
    }

    const body = (await response.json()) as GitHubAppTokenResponse;
    return {
      token: body.token,
      expiresAt: body.expires_at,
    };
  }

  private buildHeaders(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };
  }
}
