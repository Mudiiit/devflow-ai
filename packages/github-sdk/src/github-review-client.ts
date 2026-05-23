import type { GitHubPullRequestFile, GitHubReviewComment, GitHubReviewState, PublishReviewInput, PublishedReviewResult } from './types.js';

class GitHubApiError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.statusCode = statusCode;
  }
}

const retryableStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

const retryFetch = async <T>(execute: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await execute();
    } catch (error: unknown) {
      lastError = error;
      const statusCode = error instanceof GitHubApiError ? error.statusCode : undefined;
      const isRetryable = typeof statusCode === 'number' ? retryableStatuses.has(statusCode) : error instanceof Error;

      if (attempt >= attempts || !isRetryable) {
        throw error;
      }

      await sleep(200 * attempt * attempt);
    }
  }

  throw lastError;
};

const buildHeaders = (accessToken: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${accessToken}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const toReviewState = (state: GitHubReviewState): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' => {
  if (state === 'approve') {
    return 'APPROVE';
  }

  if (state === 'request_changes') {
    return 'REQUEST_CHANGES';
  }

  return 'COMMENT';
};

interface GitHubPullRequestFileListResponse {
  readonly files: ReadonlyArray<GitHubPullRequestFile>;
}

interface GitHubReviewResponse {
  readonly id: number;
  readonly state: string;
  readonly html_url: string | null;
}

export class GitHubReviewClient {
  private readonly apiBase = 'https://api.github.com';

  public async fetchPullRequestFiles(
    owner: string,
    repository: string,
    pullRequestNumber: number,
    accessToken: string,
  ): Promise<GitHubPullRequestFile[]> {
    const files: GitHubPullRequestFile[] = [];

    for (let page = 1; ; page += 1) {
      const response = await retryFetch(async () => {
        const request = await fetch(
          `${this.apiBase}/repos/${owner}/${repository}/pulls/${pullRequestNumber}/files?per_page=100&page=${page}`,
          { headers: buildHeaders(accessToken) },
        );

        if (!request.ok) {
          throw new GitHubApiError(`GitHub pull request file request failed with status ${request.status}`, request.status);
        }

        return (await request.json()) as ReadonlyArray<GitHubPullRequestFile>;
      });

      if (response.length === 0) {
        break;
      }

      files.push(...response);
    }

    return files;
  }

  public async publishReview(input: PublishReviewInput, accessToken: string): Promise<PublishedReviewResult> {
    const reviewComments = input.comments.map((comment) => this.toReviewCommentPayload(comment));

    const response = await retryFetch(async () => {
      const request = await fetch(
        `${this.apiBase}/repos/${input.owner}/${input.repository}/pulls/${input.pullRequestNumber}/reviews`,
        {
          method: 'POST',
          headers: buildHeaders(accessToken),
          body: JSON.stringify({
            commit_id: input.commitSha,
            body: input.body,
            event: toReviewState(input.state),
            comments: reviewComments,
          }),
        },
      );

      if (!request.ok) {
        throw new GitHubApiError(`GitHub review publish failed with status ${request.status}`, request.status);
      }

      return (await request.json()) as GitHubReviewResponse;
    });

    return {
      id: response.id,
      state: response.state,
      htmlUrl: response.html_url,
    };
  }

  private toReviewCommentPayload(comment: GitHubReviewComment): Record<string, unknown> {
    return {
      path: comment.path,
      line: comment.line,
      side: comment.side,
      body: comment.body,
      ...(comment.startLine === undefined ? {} : { start_line: comment.startLine, start_side: comment.side }),
    };
  }
}
