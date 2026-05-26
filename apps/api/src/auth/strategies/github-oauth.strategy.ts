import { Injectable } from '@nestjs/common';
import { GitHubOAuthService } from '../services/github-oauth.service.js';

@Injectable()
export class GitHubOAuthStrategy {
  constructor(private readonly githubOAuthService: GitHubOAuthService) {}

  buildAuthorizationUrl(state: string, returnTo?: string): URL {
    return this.githubOAuthService.buildAuthorizationUrl(state, returnTo);
  }

  exchangeCodeForToken(code: string): Promise<string> {
    return this.githubOAuthService.exchangeCodeForToken(code);
  }

  fetchProfile(accessToken: string) {
    return this.githubOAuthService.fetchProfile(accessToken);
  }
}
