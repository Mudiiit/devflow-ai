import { Injectable } from '@nestjs/common';
import { GitHubAppService } from '../services/github-app.service.js';

@Injectable()
export class GitHubAppStrategy {
  constructor(private readonly githubAppService: GitHubAppService) {}

  buildInstallationUrl(state: string): URL {
    return this.githubAppService.buildInstallationUrl(state);
  }
}
