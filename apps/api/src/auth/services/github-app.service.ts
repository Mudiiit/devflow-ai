import { Injectable } from '@nestjs/common';
import { serverEnv } from '@devflow/config';
import { StructuredLoggerService } from '@devflow/logger';
import { normalizePrivateKey, signGitHubAppJwt } from '../utils/crypto.js';

@Injectable()
export class GitHubAppService {
  private readonly apiBase = 'https://api.github.com';

  constructor(private readonly logger: StructuredLoggerService) {}

  private get appId(): string {
    if (!serverEnv.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID is required for GitHub App integration');
    }

    return serverEnv.GITHUB_APP_ID;
  }

  private get privateKey(): string {
    if (!serverEnv.GITHUB_APP_PRIVATE_KEY) {
      throw new Error(
        'GITHUB_APP_PRIVATE_KEY is required for GitHub App integration',
      );
    }

    return normalizePrivateKey(serverEnv.GITHUB_APP_PRIVATE_KEY);
  }

  private get slug(): string {
    if (!('GITHUB_APP_SLUG' in serverEnv) || !serverEnv.GITHUB_APP_SLUG) {
      throw new Error('GITHUB_APP_SLUG is required to build installation URLs');
    }

    return serverEnv.GITHUB_APP_SLUG;
  }

  buildInstallationUrl(state: string): URL {
    const url = new URL(
      `https://github.com/apps/${this.slug}/installations/new`,
    );
    url.searchParams.set('state', state);
    return url;
  }

  signAppJwt(): string {
    return signGitHubAppJwt(this.appId, this.privateKey);
  }

  async createInstallationAccessToken(
    installationId: number,
  ): Promise<{ token: string; expiresAt: string }> {
    const response = await fetch(
      `${this.apiBase}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.signAppJwt()}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      this.logger.event('error', 'github.installation.token.failed', {
        installationId,
        status: response.status,
        statusText: response.statusText,
      });

      throw new Error(
        `GitHub App token request failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      token: string;
      expires_at: string;
    };
    return { token: body.token, expiresAt: body.expires_at };
  }

  async listInstallationRepositories(installationId: number): Promise<
    Array<{
      id: number;
      name: string;
      full_name: string;
      default_branch: string;
      private: boolean;
      archived: boolean;
      fork: boolean;
      language: string | null;
      visibility?: 'public' | 'private' | 'internal';
    }>
  > {
    const { token } = await this.createInstallationAccessToken(installationId);
    const response = await fetch(`${this.apiBase}/installation/repositories`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      this.logger.event('error', 'github.installation.repositories.failed', {
        installationId,
        status: response.status,
        statusText: response.statusText,
      });

      throw new Error(
        `GitHub installation repository listing failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      repositories: Array<{
        id: number;
        name: string;
        full_name: string;
        default_branch: string;
        private: boolean;
        archived: boolean;
        fork: boolean;
        language: string | null;
        visibility?: 'public' | 'private' | 'internal';
      }>;
    };

    return body.repositories;
  }
}
