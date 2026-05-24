import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SpanKind } from '@opentelemetry/api';
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
  NotificationsRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewCommentsRepository,
  ReviewJobsRepository,
  ReviewMetricsRepository,
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
import { runWithSpan } from '@devflow/tracing';

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

const mapSeverityToReviewState = (input: {
  readonly severity: ReviewSeverity;
  readonly findingCount: number;
  readonly riskScore: number;
}): GitHubReviewState => {
  if (input.findingCount === 0) {
    return 'approve';
  }

  if (input.severity === 'critical' || input.riskScore >= 70) {
    return 'request_changes';
  }

  return 'comment';
};

const normalizeTitleKey = (title: string): string => {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
};

const buildReviewCommentBody = (finding: ReviewFinding): string => {
  const parts = [`**[${finding.category}] ${finding.title}**`, `Severity: ${finding.severity}`, finding.summary];

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

type ReviewCommentGroup = {
  readonly key: string;
  readonly path?: string;
  readonly line: number;
  readonly startLine?: number;
  readonly body: string;
  readonly findings: ReadonlyArray<ReviewFinding>;
};

type ReviewCommentGroupBuilder = {
  key: string;
  path?: string;
  line: number;
  startLine?: number;
  body: string;
  findings: ReviewFinding[];
  titleKeys: Set<string>;
  severityRank: number;
  avgConfidence: number;
};

const toFindingLineRange = (finding: ReviewFinding): { readonly start: number; readonly end: number } => {
  const start = finding.lineStart ?? finding.lineEnd ?? 1;
  const end = finding.lineEnd ?? start;
  return { start, end };
};

const hasLineOverlap = (group: ReviewCommentGroupBuilder, finding: ReviewFinding): boolean => {
  const range = toFindingLineRange(finding);
  return range.start <= group.line + 2 && range.end >= (group.startLine ?? group.line) - 2;
};

const buildGroupedReviewCommentBody = (findings: ReadonlyArray<ReviewFinding>): string => {
  return findings.map((finding) => buildReviewCommentBody(finding)).join('\n\n---\n\n');
};

const getFindingSeverityRank = (finding: ReviewFinding): number => {
  if (finding.severity === 'critical') {
    return 3;
  }

  if (finding.severity === 'warning') {
    return 2;
  }

  return 1;
};

const groupReviewFindings = (findings: ReadonlyArray<ReviewFinding>): ReviewCommentGroup[] => {
  const groups: ReviewCommentGroupBuilder[] = [];
  const sorted = [...findings].filter((finding) => finding.filePath !== undefined).sort((left, right) => {
    const pathDelta = (left.filePath ?? '').localeCompare(right.filePath ?? '');
    if (pathDelta !== 0) {
      return pathDelta;
    }

    return (left.lineStart ?? left.lineEnd ?? 0) - (right.lineStart ?? right.lineEnd ?? 0);
  });

  for (const finding of sorted) {
    const titleKey = normalizeTitleKey(finding.title);
    const targetGroup = groups.find((group) =>
      group.path === finding.filePath && hasLineOverlap(group, finding) &&
      (group.titleKeys.has(titleKey) || group.findings[0]?.category === finding.category),
    );

    if (targetGroup) {
      targetGroup.findings.push(finding);
      targetGroup.titleKeys.add(titleKey);
      targetGroup.body = buildGroupedReviewCommentBody(targetGroup.findings);
      const range = toFindingLineRange(finding);
      targetGroup.startLine = Math.min(targetGroup.startLine ?? range.start, range.start);
      targetGroup.line = Math.max(targetGroup.line, range.end);
      targetGroup.severityRank = Math.max(targetGroup.severityRank, getFindingSeverityRank(finding));
      const confidenceValues = targetGroup.findings
        .map((entry) => entry.confidence)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      targetGroup.avgConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
        : targetGroup.avgConfidence;
      continue;
    }

    const range = toFindingLineRange(finding);
    groups.push({
      key: `${finding.filePath ?? 'general'}:${range.start}-${range.end}:${titleKey}`,
      path: finding.filePath,
      line: range.end,
      startLine: range.start < range.end ? range.start : undefined,
      body: buildGroupedReviewCommentBody([finding]),
      findings: [finding],
      titleKeys: new Set([titleKey]),
      severityRank: getFindingSeverityRank(finding),
      avgConfidence: typeof finding.confidence === 'number' ? finding.confidence : 0.6,
    });
  }

  const MAX_INLINE_COMMENTS = 20;
  const MAX_COMMENTS_PER_FILE = 6;
  const byFile = new Map<string, ReviewCommentGroupBuilder[]>();

  for (const group of groups) {
    const path = group.path ?? '';
    const bucket = byFile.get(path);
    if (bucket === undefined) {
      byFile.set(path, [group]);
    } else {
      bucket.push(group);
    }
  }

  const limited: ReviewCommentGroupBuilder[] = [];

  for (const [, bucket] of byFile.entries()) {
    bucket.sort((left, right) => {
      const severityDelta = right.severityRank - left.severityRank;
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return (right.avgConfidence ?? 0) - (left.avgConfidence ?? 0);
    });

    limited.push(...bucket.slice(0, MAX_COMMENTS_PER_FILE));
  }

  limited.sort((left, right) => {
    const severityDelta = right.severityRank - left.severityRank;
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return (right.avgConfidence ?? 0) - (left.avgConfidence ?? 0);
  });

  return limited.slice(0, MAX_INLINE_COMMENTS).map((group) => ({
    key: group.key,
    ...(group.path === undefined ? {} : { path: group.path }),
    line: group.line,
    ...(group.startLine === undefined ? {} : { startLine: group.startLine }),
    body: group.body,
    findings: group.findings,
  }));
};

const buildSummaryBody = (input: {
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly result: ReviewExecutionResult;
  readonly reviewState: GitHubReviewState;
  readonly providerAttempts: ReadonlyArray<ProviderAttempt>;
}): string => {
  const providerSummary = input.providerAttempts.map((attempt) => `${attempt.provider}:${attempt.model}`).join(', ');
  const topFindings = input.result.findings.slice(0, 3).map((finding) => {
    const confidence = typeof finding.confidence === 'number' ? Math.round(finding.confidence * 100) : 60;
    const line = finding.lineStart ?? finding.lineEnd;
    const location = finding.filePath ? ` (${finding.filePath}${line ? `:${line}` : ''})` : '';
    return `- [${finding.severity}] ${finding.title}${location} (confidence ${confidence}/100)`;
  });

  return [
    `DevFlow AI review for ${input.repositoryFullName} #${input.pullRequestNumber}`,
    `Overall severity: ${input.result.overallSeverity}`,
    `Review state: ${input.reviewState}`,
    `Findings: ${input.result.findings.length}`,
    `Risk score: ${input.result.riskScore}/100`,
    `Confidence score: ${input.result.confidenceScore}/100`,
    `Chunks: ${input.result.chunkCount}`,
    `Focus areas: ${input.result.focusAreaCount}`,
    `Tokens processed: ${input.result.totalTokens}`,
    `Execution time: ${input.result.executionMs}ms`,
    `Provider attempts: ${providerSummary}`,
    ...(input.result.suppressedFindings > 0 ? [`Suppressed findings: ${input.result.suppressedFindings}`] : []),
    '',
    input.result.summary,
    ...(topFindings.length > 0 ? ['', 'Top findings:', ...topFindings] : []),
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
    private readonly reviewMetricsRepository: ReviewMetricsRepository,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async processReviewJob(reviewJobId: string): Promise<ReviewOrchestrationResult> {
    return runWithSpan('review.job.process', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'review.job.id': reviewJobId,
      },
    }, async () => {
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
      const reviewState = mapSeverityToReviewState({
        severity: executionResult.overallSeverity,
        findingCount: executionResult.findings.length,
        riskScore: executionResult.riskScore,
      });
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
        recipientUserId: reviewJob.requestedByUserId ?? repository.ownerUserId,
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
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

      await this.persistFailureNotification({
        recipientUserId: reviewJob.requestedByUserId ?? repository.ownerUserId,
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
        reviewJobId: reviewJob.id,
        message,
      });

      throw error;
    }
    });
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
        const result = await runWithSpan('review.execution.provider', {
          kind: SpanKind.INTERNAL,
          attributes: {
            'review.job.id': input.reviewJob.id,
            'ai.provider': providerName,
            'ai.model': model,
          },
        }, async () => {
          return this.executionEngine.execute(
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
                  chunkType: chunkResult.fileKind === 'patch' ? 'diff' : 'file',
                  sourcePath: chunkResult.sourcePath,
                  lineStart: chunkResult.lineStart ?? null,
                  lineEnd: chunkResult.lineEnd ?? null,
                  tokenCount: chunkResult.tokenCount,
                  content: chunkResult.content,
                  summary: chunkResult.summary,
                  metadata: {
                    focusArea: chunkResult.focusArea,
                    fileStatus: chunkResult.fileStatus,
                    fileKind: chunkResult.fileKind,
                    previousPath: chunkResult.previousPath ?? null,
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
        });

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

    for (const group of groupReviewFindings(input.findings)) {
      if (group.path === undefined) {
        continue;
      }

      comments.push({
        path: group.path,
        line: group.line,
        side: 'RIGHT',
        body: group.body,
        ...(group.startLine === undefined ? {} : { startLine: group.startLine }),
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
    readonly recipientUserId: string | null;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
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
        riskScore: input.executionResult.riskScore,
        confidenceScore: input.executionResult.confidenceScore,
        suppressedFindings: input.executionResult.suppressedFindings,
      },
    });

    await this.reviewMetricsRepository.upsertForReviewJob({
      reviewJobId: input.reviewJobId,
      pullRequestId: input.pullRequestId,
      repositoryId: input.repositoryId,
      overallSeverity: input.executionResult.overallSeverity,
      riskScore: input.executionResult.riskScore,
      confidenceScore: input.executionResult.confidenceScore,
      findingCount: input.executionResult.findings.length,
      suppressedCount: input.executionResult.suppressedFindings,
      chunkCount: input.executionResult.chunkCount,
      focusAreaCount: input.executionResult.focusAreaCount,
      totalTokens: input.executionResult.totalTokens,
      executionMs: input.executionMs,
      summary: input.executionResult.summary,
      provider: input.executionResult.selectedProvider,
      model: input.executionResult.selectedModel,
      severityCounts: input.executionResult.severityCounts,
      categoryCounts: input.executionResult.categoryCounts,
      publishedAt: new Date(),
      metadata: {
        providerAttempts: input.providerAttempts,
        githubReview: input.publication,
      },
    });

    for (const group of groupReviewFindings(input.findings)) {
      const threadId = `${input.reviewJobId}:${group.key}`;
      const representativeFinding = group.findings[0];
      if (representativeFinding === undefined) {
        continue;
      }

      await this.reviewCommentsRepository.upsertByThreadId(threadId, {
        reviewJobId: input.reviewJobId,
        pullRequestId: input.pullRequestId,
        repositoryId: input.repositoryId,
        source: 'ai',
        visibility: 'public',
        threadId,
        path: representativeFinding.filePath ?? null,
        lineNumber: group.line,
        side: 'RIGHT',
        body: group.body,
        bodyMarkdown: group.body,
        metadata: {
          findings: group.findings,
          severity: representativeFinding.severity,
          category: representativeFinding.category,
          title: representativeFinding.title,
          summary: representativeFinding.summary,
          rationale: representativeFinding.rationale ?? null,
          suggestion: representativeFinding.suggestion ?? null,
          tags: representativeFinding.tags,
          publication: input.publication,
          providerAttempts: input.providerAttempts,
        },
      });
    }

    await this.persistSuccessNotification({
      recipientUserId: input.recipientUserId,
      repositoryFullName: input.repositoryFullName,
      pullRequestNumber: input.pullRequestNumber,
      reviewJobId: input.reviewJobId,
      findingsCount: input.executionResult.findings.length,
      overallSeverity: input.executionResult.overallSeverity,
      riskScore: input.executionResult.riskScore,
      confidenceScore: input.executionResult.confidenceScore,
    });
  }

  private async persistSuccessNotification(input: {
    readonly recipientUserId: string | null;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly reviewJobId: string;
    readonly findingsCount: number;
    readonly overallSeverity: ReviewSeverity;
    readonly riskScore: number;
    readonly confidenceScore: number;
  }): Promise<void> {
    const recipientUserId = input.recipientUserId;

    if (recipientUserId === null) {
      return;
    }

    await runWithSpan('review.notification.success', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'review.job.id': input.reviewJobId,
        'review.notification.type': 'review_completed',
      },
    }, async () => {
      await this.notificationsRepository.createNotification({
        userId: recipientUserId,
        type: 'review_completed',
        deliveryChannel: 'in_app',
        title: `Review completed for ${input.repositoryFullName} #${input.pullRequestNumber}`,
        body: `DevFlow AI completed the review with ${input.findingsCount} findings and ${input.overallSeverity} severity.`,
        actionUrl: `/dashboard/reviews/${input.reviewJobId}`,
        payload: {
          reviewJobId: input.reviewJobId,
          repositoryFullName: input.repositoryFullName,
          pullRequestNumber: input.pullRequestNumber,
          findingsCount: input.findingsCount,
          overallSeverity: input.overallSeverity,
          riskScore: input.riskScore,
          confidenceScore: input.confidenceScore,
        },
        metadata: {
          source: 'review_pipeline',
        },
      });
    });
  }

  private async persistFailureNotification(input: {
    readonly recipientUserId: string | null;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly reviewJobId: string;
    readonly message: string;
  }): Promise<void> {
    const recipientUserId = input.recipientUserId;

    if (recipientUserId === null) {
      return;
    }

    await runWithSpan('review.notification.failure', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'review.job.id': input.reviewJobId,
        'review.notification.type': 'review_failed',
      },
    }, async () => {
      await this.notificationsRepository.createNotification({
        userId: recipientUserId,
        type: 'review_failed',
        deliveryChannel: 'in_app',
        title: `Review failed for ${input.repositoryFullName} #${input.pullRequestNumber}`,
        body: input.message,
        actionUrl: `/dashboard/reviews/${input.reviewJobId}`,
        payload: {
          reviewJobId: input.reviewJobId,
          repositoryFullName: input.repositoryFullName,
          pullRequestNumber: input.pullRequestNumber,
          errorMessage: input.message,
        },
        metadata: {
          source: 'review_pipeline',
        },
      });
    });
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
