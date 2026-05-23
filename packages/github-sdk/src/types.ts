export interface GitHubAppCredentials {
  readonly appId: string;
  readonly privateKey: string;
}

export interface GitHubInstallationAccessToken {
  readonly token: string;
  readonly expiresAt: string;
}

export interface GitHubPullRequestFile {
  readonly sha: string;
  readonly filename: string;
  readonly status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly patch: string | null;
  readonly blob_url: string;
  readonly raw_url: string;
  readonly contents_url: string;
  readonly previous_filename?: string;
}

export interface ReviewableFileDiff {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: GitHubPullRequestFile['status'];
  readonly kind: 'patch' | 'binary' | 'skipped';
  readonly diff: string;
  readonly summary: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly language?: string;
  readonly isBinary?: boolean;
  readonly isSkipped?: boolean;
}

export type GitHubReviewState = 'comment' | 'approve' | 'request_changes';

export interface GitHubReviewComment {
  readonly path: string;
  readonly line: number;
  readonly side: 'RIGHT';
  readonly body: string;
  readonly startLine?: number;
}

export interface PublishReviewInput {
  readonly owner: string;
  readonly repository: string;
  readonly pullRequestNumber: number;
  readonly commitSha: string;
  readonly state: GitHubReviewState;
  readonly body: string;
  readonly comments: ReadonlyArray<GitHubReviewComment>;
}

export interface PublishedReviewResult {
  readonly id: number;
  readonly state: string;
  readonly htmlUrl: string | null;
}
