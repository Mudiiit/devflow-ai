import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  createAIProvider,
  type AIProvider,
  type AIProviderName,
  type ReviewChunkResult,
  type ReviewExecutionInput,
  type ReviewFinding,
  type ReviewFocusArea,
  type ReviewOrchestrationResult,
  type ReviewSeverity,
  ReviewExecutionEngine,
  reviewFocusAreas,
} from '@devflow/ai-engine';
import {
  AiReviewChunksRepository,
  GithubInstallationsRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  type ReviewJob,
} from '@devflow/database';
import {
  GitHubAppClient,
  GitHubReviewClient,
  normalizePullRequestFiles,
  type GitHubAppCredentials,
  type GitHubReviewComment,
  type GitHubReviewState,
  type PublishedReviewResult,
} from '@devflow/github-sdk';

type ReviewJobInputPayload = Record<string, unknown> & {
  readonly focusAreas?: ReadonlyArray<ReviewFocusArea>;
  readonly provider?: AIProviderName;
  readonly model?: string;
  readonly maxChunkTokens?: number;
  readonly requestId?: string;
  readonly timeoutMs?: number;
};

type ProviderAttempt = {
  readonly provider: AIProviderName;
  readonly model: string;
};

type ReviewExecutionResult = ReviewOrchestrationResult & {
  readonly providerAttempts: ReadonlyArray<ProviderAttempt>;
  readonly selectedProvider: AIProviderName;
  readonly selectedModel: string;
  readonly executionMs: number;
};

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-2.0-flash',
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toStringValue = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const splitRepositoryFullName = (fullName: string): { readonly owner: string; readonly repository: string } => {
  const [owner, repository] = fullName.split('/');
  if (!owner || !repository) {
    throw new Error(`Repository full name is invalid: ${fullName}`);
  }

  return { owner, repository };
};

const mapSeverityToReviewState = (severity: ReviewSeverity, findingCount: number): GitHubReviewState => {
  if (findingCount === 0) {
    return 'approve';
  }

  if (severity === 'critical') {
    return 'request_changes';
  }

  return 'comment';
};

const buildReviewCommentBody = (finding: ReviewFinding): string => {
  const parts = [`**${finding.title}**`, finding.summary];

  if (finding.rationale !== undefined) {
    parts.push(`Rationale: ${finding.rationale}`);
  }

  if (finding.suggestion !== undefined) {
    parts.push(`Suggestion: ${finding.suggestion}`);
  }

  if (finding.tags.length > 0) {
    parts.push(`Tags: ${finding.tags.join(', ')}`);
  }

  return parts.join('\n\n');
};

const buildSummaryBody = (input: {
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly result: ReviewExecutionResult;
  readonly reviewState: GitHubReviewState;
  readonly providerAttempts: ReadonlyArray<ProviderAttempt>;
}): string => {
  const providerSummary = input.providerAttempts.map((attempt) => `${attempt.provider}:${attempt.model}`).join(', ');

  return [
    `DevFlow AI review for ${input.repositoryFullName} #${input.pullRequestNumber}`,
    `Overall severity: ${input.result.overallSeverity}`,
    `Review state: ${input.reviewState}`,
    `Findings: ${input.result.findings.length}`,
    `Chunks: ${input.result.chunkCount}`,
    `Focus areas: ${input.result.focusAreaCount}`,
    `Tokens processed: ${input.result.totalTokens}`,
    `Execution time: ${input.result.executionMs}ms`,
    `Provider attempts: ${providerSummary}`,
    '',
    input.result.summary,
  ].join('\n');
};

@Injectable()
export class ReviewPipelineService {
  private readonly executionEngine = new ReviewExecutionEngine();
  private readonly providerCache = new Map<AIProviderName, AIProvider>();
  private readonly githubReviewClient = new GitHubReviewClient();

  constructor(
    private readonly reviewJobsRepository: ReviewJobsRepository,
    private readonly githubInstallationsRepository: GithubInstallationsRepository,
    private readonly aiReviewChunksRepository: AiReviewChunksRepository,
    private readonly reviewCommentsRepository: ReviewCommentsRepository,
    private readonly pullRequestsRepository: PullRequestsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  async processReviewJob(reviewJobId: string): Promise<ReviewOrchestrationResult> {
    const reviewJob = await this.reviewJobsRepository.findById(reviewJobId);
    if (!reviewJob) {
      throw new Error(`Review job ${reviewJobId} was not found`);
    }

    if (reviewJob.status === 'completed' && this.isCompletedResult(reviewJob.output)) {
      return reviewJob.output;
    }

    const input = this.parseJobInput(reviewJob);
    const pullRequest = await this.pullRequestsRepository.findById(reviewJob.pullRequestId);
    if (!pullRequest) {
      throw new Error(`Pull request ${reviewJob.pullRequestId} was not found`);
    }

    const repository = await this.repositoriesRepository.findById(reviewJob.repositoryId);
    if (!repository) {
      throw new Error(`Repository ${reviewJob.repositoryId} was not found`);
    }

    const installation = await this.githubInstallationsRepository.findById(repository.githubInstallationId);
    if (!installation) {
      throw new Error(`GitHub installation ${repository.githubInstallationId} was not found`);
    }

    const leaseToken = randomUUID();
    const leased = await this.reviewJobsRepository.claimLease(reviewJob.id, leaseToken);
    if (!leased) {
      throw new Error(`Review job ${reviewJob.id} is no longer available for processing`);
    }

    const gitHubAppClient = this.resolveGitHubAppClient();
    const gitHubAccessToken = await gitHubAppClient.createInstallationAccessToken(installation.githubInstallationId);
    const ownerRepository = splitRepositoryFullName(repository.fullName);
    const rawFiles = await this.githubReviewClient.fetchPullRequestFiles(
      ownerRepository.owner,
      ownerRepository.repository,
      pullRequest.number,
      gitHubAccessToken.token,
    );
    const files = normalizePullRequestFiles(rawFiles);

    if (files.length === 0) {
      await this.reviewJobsRepository.updateStatus(reviewJob.id, 'failed', {
        failedAt: new Date(),
        errorMessage: 'Review job does not contain any diff files to analyze',
        retryCount: reviewJob.retryCount + 1,
        leaseToken,
      });

      throw new Error('Review job does not contain any diff files to analyze');
    }

    await this.reviewJobsRepository.updateStatus(reviewJob.id, 'processing', {
      leaseToken,
      input: {
        ...reviewJob.input,
        reviewPipeline: {
          repositoryFullName: repository.fullName,
          pullRequestNumber: pullRequest.number,
          provider: input.provider ?? null,
          focusAreas: input.focusAreas,
        },
      },
    });

    const startedAt = Date.now();
    const providerAttempts: ProviderAttempt[] = [];

    try {
      const executionResult = await this.executeWithFallback({
        reviewJob,
        leaseToken,
        requestId: input.requestId ?? reviewJob.id,
        files,
        focusAreas: input.focusAreas ?? reviewFocusAreas,
        preferredProvider: input.provider,
        preferredModel: input.model,
        timeoutMs: input.timeoutMs,
        maxChunkTokens: input.maxChunkTokens,
        providerAttempts,
      });
      const executionMs = Date.now() - startedAt;
      const reviewState = mapSeverityToReviewState(executionResult.overallSeverity, executionResult.findings.length);
      const summaryBody = buildSummaryBody({
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
        result: executionResult,
        reviewState,
        providerAttempts,
      });

      const publication = await this.publishReview({
        accessToken: gitHubAccessToken.token,
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
        headSha: pullRequest.headSha,
        reviewState,
        summaryBody,
        findings: executionResult.findings,
      });

      await this.persistReviewArtifacts({
        reviewJobId: reviewJob.id,
        pullRequestId: reviewJob.pullRequestId,
        repositoryId: reviewJob.repositoryId,
        findings: executionResult.findings,
        summaryBody,
        publication,
        providerAttempts,
        executionResult,
        executionMs,
      });

      const completed = await this.reviewJobsRepository.updateStatus(reviewJob.id, 'completed', {
        completedAt: new Date(),
        output: {
          ...executionResult,
          executionMs,
          providerAttempts,
          selectedProvider: executionResult.selectedProvider,
          selectedModel: executionResult.selectedModel,
          githubReview: publication,
          repositoryId: repository.id,
          repositoryFullName: repository.fullName,
          pullRequestId: pullRequest.id,
          pullRequestNumber: pullRequest.number,
          leaseToken,
        },
      });

      if (!completed) {
        throw new Error(`Failed to persist completion state for review job ${reviewJob.id}`);
      }

      return executionResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown review pipeline failure';

      await this.reviewJobsRepository.updateStatus(reviewJob.id, 'failed', {
        failedAt: new Date(),
        errorMessage: message,
        retryCount: reviewJob.retryCount + 1,
        leaseToken,
      });

      throw error;
    }
  }

  private async executeWithFallback(input: {
    readonly reviewJob: ReviewJob;
    readonly leaseToken: string;
    readonly requestId: string;
    readonly files: ReadonlyArray<ReturnType<typeof normalizePullRequestFiles>[number]>;
    readonly focusAreas: ReadonlyArray<ReviewFocusArea>;
    readonly preferredProvider?: AIProviderName;
    readonly preferredModel?: string;
    readonly timeoutMs?: number;
    readonly maxChunkTokens?: number;
    readonly providerAttempts: ProviderAttempt[];
  }): Promise<ReviewExecutionResult> {
    const providerOrder = this.resolveProviderOrder(input.preferredProvider);
    let lastError: unknown = new Error('No AI provider could process the review');

    for (const providerName of providerOrder) {
      const model = input.preferredProvider === providerName && input.preferredModel !== undefined
        ? input.preferredModel
        : DEFAULT_MODELS[providerName];

      const provider = this.resolveProvider(providerName);
      input.providerAttempts.push({ provider: providerName, model });

      await this.aiReviewChunksRepository.deleteByReviewJobId(input.reviewJob.id);

      try {
        const startedAt = Date.now();
        const result = await this.executionEngine.execute(
          {
            provider,
            model,
            files: input.files,
            focusAreas: input.focusAreas,
            maxChunkTokens: input.maxChunkTokens,
            timeoutMs: input.timeoutMs,
            requestId: input.requestId,
            promptVersion: 'review-v1',
          },
          {
            onStateChange: async (state) => {
              await this.reviewJobsRepository.updateStatus(input.reviewJob.id, state, {
                leaseToken: input.leaseToken,
              });
            },
            onChunkResult: async (chunkResult: ReviewChunkResult) => {
              await this.aiReviewChunksRepository.upsertForReviewJob({
                reviewJobId: input.reviewJob.id,
                pullRequestId: input.reviewJob.pullRequestId,
                repositoryId: input.reviewJob.repositoryId,
                chunkIndex: chunkResult.chunkIndex,
                chunkType: 'diff',
                sourcePath: chunkResult.sourcePath,
                lineStart: chunkResult.content.length > 0 ? 1 : null,
                lineEnd: chunkResult.content.length > 0 ? chunkResult.content.split(/\r?\n/).length : null,
                tokenCount: chunkResult.tokenCount,
                content: chunkResult.content,
                summary: chunkResult.summary,
                metadata: {
                  focusArea: chunkResult.focusArea,
                  promptVersion: chunkResult.promptVersion,
                  provider: chunkResult.provider,
                  model: chunkResult.model,
                  findingCount: chunkResult.findings.length,
                  usage: chunkResult.usage,
                },
              });
            },
          },
        );

        return {
          ...result,
          providerAttempts: [...input.providerAttempts],
          selectedProvider: providerName,
          selectedModel: model,
          executionMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No AI provider could process the review');
  }

  private async publishReview(input: {
    readonly accessToken: string;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly headSha: string;
    readonly reviewState: GitHubReviewState;
    readonly summaryBody: string;
    readonly findings: ReadonlyArray<ReviewFinding>;
  }): Promise<PublishedReviewResult> {
    const { owner, repository } = splitRepositoryFullName(input.repositoryFullName);
    const comments: GitHubReviewComment[] = [];

    for (const finding of input.findings) {
      if (finding.filePath === undefined) {
        continue;
      }

      const line = finding.lineEnd ?? finding.lineStart ?? 1;
      comments.push({
        path: finding.filePath,
        line,
        side: 'RIGHT',
        body: buildReviewCommentBody(finding),
        ...(finding.lineStart !== undefined && finding.lineEnd !== undefined && finding.lineEnd > finding.lineStart
          ? { startLine: finding.lineStart }
          : {}),
      });
    }

    return this.githubReviewClient.publishReview(
      {
        owner,
        repository,
        pullRequestNumber: input.pullRequestNumber,
        commitSha: input.headSha,
        state: input.reviewState,
        body: input.summaryBody,
        comments,
      },
      input.accessToken,
    );
  }

  private async persistReviewArtifacts(input: {
    readonly reviewJobId: string;
    readonly pullRequestId: string;
    readonly repositoryId: string;
    readonly findings: ReadonlyArray<ReviewFinding>;
    readonly summaryBody: string;
    readonly publication: PublishedReviewResult;
    readonly providerAttempts: ReadonlyArray<ProviderAttempt>;
    readonly executionResult: ReviewExecutionResult;
    readonly executionMs: number;
  }): Promise<void> {
    const summaryThreadId = `${input.reviewJobId}:summary`;
    await this.reviewCommentsRepository.upsertByThreadId(summaryThreadId, {
      reviewJobId: input.reviewJobId,
      pullRequestId: input.pullRequestId,
      repositoryId: input.repositoryId,
      source: 'system',
      visibility: 'public',
      threadId: summaryThreadId,
      body: input.summaryBody,
      bodyMarkdown: input.summaryBody,
      metadata: {
        reviewPublication: input.publication,
        providerAttempts: input.providerAttempts,
        executionMs: input.executionMs,
        totalTokens: input.executionResult.totalTokens,
        overallSeverity: input.executionResult.overallSeverity,
      },
    });

    for (const finding of input.findings) {
      const line = finding.lineEnd ?? finding.lineStart ?? 1;
      const threadId = `${input.reviewJobId}:${finding.filePath ?? 'general'}:${line}:${finding.title}`;

      await this.reviewCommentsRepository.upsertByThreadId(threadId, {
        reviewJobId: input.reviewJobId,
        pullRequestId: input.pullRequestId,
        repositoryId: input.repositoryId,
        source: 'ai',
        visibility: 'public',
        threadId,
        path: finding.filePath ?? null,
        lineNumber: line,
        side: 'RIGHT',
        body: buildReviewCommentBody(finding),
        bodyMarkdown: buildReviewCommentBody(finding),
        metadata: {
          severity: finding.severity,
          title: finding.title,
          summary: finding.summary,
          rationale: finding.rationale ?? null,
          suggestion: finding.suggestion ?? null,
          tags: finding.tags,
          publication: input.publication,
          providerAttempts: input.providerAttempts,
        },
      });
    }
  }

  private parseJobInput(reviewJob: ReviewJob): ReviewJobInputPayload {
    const input = isRecord(reviewJob.input) ? (reviewJob.input as ReviewJobInputPayload) : {};

    return {
      ...input,
      focusAreas: input.focusAreas !== undefined && input.focusAreas.length > 0 ? input.focusAreas : reviewFocusAreas,
    };
  }

  private resolveProviderOrder(preferredProvider?: AIProviderName): AIProviderName[] {
    const configuredProviders: AIProviderName[] = [];

    if (this.isProviderConfigured('openai')) {
      configuredProviders.push('openai');
    }

    if (this.isProviderConfigured('anthropic')) {
      configuredProviders.push('anthropic');
    }

    if (this.isProviderConfigured('gemini')) {
      configuredProviders.push('gemini');
    }

    const preferred = preferredProvider ?? this.resolveDefaultProviderName();
    return [preferred, ...configuredProviders.filter((provider) => provider !== preferred)];
  }

  private resolveDefaultProviderName(): AIProviderName {
    const configuredProvider = toStringValue(process.env.AI_REVIEW_PROVIDER);
    if (configuredProvider === 'openai' || configuredProvider === 'anthropic' || configuredProvider === 'gemini') {
      return configuredProvider;
    }

    if (this.isProviderConfigured('openai')) {
      return 'openai';
    }

    if (this.isProviderConfigured('gemini')) {
      return 'gemini';
    }

    if (this.isProviderConfigured('anthropic')) {
      return 'anthropic';
    }

    throw new Error('No review AI provider is configured');
  }

  private isProviderConfigured(providerName: AIProviderName): boolean {
    if (providerName === 'openai') {
      return toStringValue(process.env.OPENAI_API_KEY) !== undefined;
    }

    if (providerName === 'gemini') {
      return toStringValue(process.env.GEMINI_API_KEY) !== undefined;
    }

    return toStringValue(process.env.ANTHROPIC_API_KEY) !== undefined;
  }

  private resolveProvider(providerName: AIProviderName): AIProvider {
    const cached = this.providerCache.get(providerName);
    if (cached) {
      return cached;
    }

    const provider = this.createProvider(providerName);
    this.providerCache.set(providerName, provider);
    return provider;
  }

  private createProvider(providerName: AIProviderName): AIProvider {
    if (providerName === 'openai') {
      const apiKey = toStringValue(process.env.OPENAI_API_KEY);
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required to run review analysis');
      }

      return createAIProvider('openai', { apiKey });
    }

    if (providerName === 'gemini') {
      const apiKey = toStringValue(process.env.GEMINI_API_KEY);
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is required to run review analysis');
      }

      return createAIProvider('gemini', { apiKey });
    }

    const apiKey = toStringValue(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required to run review analysis');
    }

    return createAIProvider('anthropic', { apiKey });
  }

  private resolveGitHubAppClient(): GitHubAppClient {
    const appId = toStringValue(process.env.GITHUB_APP_ID);
    const privateKey = toStringValue(process.env.GITHUB_APP_PRIVATE_KEY);

    if (!appId || !privateKey) {
      throw new Error('GitHub App credentials are required to fetch pull request diffs and publish reviews');
    }

    const credentials: GitHubAppCredentials = {
      appId,
      privateKey,
    };

    return new GitHubAppClient(credentials);
  }

  private isCompletedResult(value: unknown): value is ReviewOrchestrationResult {
    if (!isRecord(value)) {
      return false;
    }

    return value.status === 'completed' && typeof value.summary === 'string' && typeof value.overallSeverity === 'string';
  }
}
