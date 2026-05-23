import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  createAIProvider,
  type AIProvider,
  type AIProviderName,
  type ReviewChunkResult,
  type ReviewExecutionInput,
  type ReviewFileDiff,
  type ReviewFocusArea,
  type ReviewOrchestrationResult,
  ReviewExecutionEngine,
  reviewFocusAreas,
} from '@devflow/ai-engine';
import {
  AiReviewChunksRepository,
  PullRequestsRepository,
  RepositoriesRepository,
  ReviewJobsRepository,
  type ReviewJob,
} from '@devflow/database';

type ReviewJobInputPayload = Record<string, unknown> & {
  readonly files?: ReadonlyArray<ReviewFileDiff>;
  readonly focusAreas?: ReadonlyArray<ReviewFocusArea>;
  readonly provider?: AIProviderName;
  readonly model?: string;
  readonly maxChunkTokens?: number;
  readonly requestId?: string;
  readonly timeoutMs?: number;
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

const normalizeReviewFiles = (value: ReadonlyArray<Record<string, unknown>>): ReviewFileDiff[] => {
  const files: ReviewFileDiff[] = [];

  for (const entry of value) {
    const path = toStringValue(entry.path);
    const diff = toStringValue(entry.diff);
    if (path === undefined || diff === undefined) {
      continue;
    }

    files.push({
      path,
      diff,
      language: toStringValue(entry.language),
      isBinary: typeof entry.isBinary === 'boolean' ? entry.isBinary : undefined,
    });
  }

  return files;
};

const isCompletedResult = (value: unknown): value is ReviewOrchestrationResult => {
  if (!isRecord(value)) {
    return false;
  }

  return value.status === 'completed' && typeof value.summary === 'string' && typeof value.overallSeverity === 'string';
};

@Injectable()
export class ReviewPipelineService {
  private readonly executionEngine = new ReviewExecutionEngine();
  private readonly providerCache = new Map<string, AIProvider>();

  constructor(
    private readonly reviewJobsRepository: ReviewJobsRepository,
    private readonly aiReviewChunksRepository: AiReviewChunksRepository,
    private readonly pullRequestsRepository: PullRequestsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  async processReviewJob(reviewJobId: string): Promise<ReviewOrchestrationResult> {
    const reviewJob = await this.reviewJobsRepository.findById(reviewJobId);
    if (!reviewJob) {
      throw new Error(`Review job ${reviewJobId} was not found`);
    }

    if (reviewJob.status === 'completed' && isCompletedResult(reviewJob.output)) {
      return reviewJob.output;
    }

    const input = this.parseJobInput(reviewJob);
    const files = input.files;

    if (files.length === 0) {
      await this.reviewJobsRepository.updateStatus(reviewJob.id, 'failed', {
        failedAt: new Date(),
        errorMessage: 'Review job does not contain any diff files to analyze',
        retryCount: reviewJob.retryCount + 1,
      });

      throw new Error('Review job does not contain any diff files to analyze');
    }

    const pullRequest = await this.pullRequestsRepository.findById(reviewJob.pullRequestId);
    if (!pullRequest) {
      throw new Error(`Pull request ${reviewJob.pullRequestId} was not found`);
    }

    const repository = await this.repositoriesRepository.findById(reviewJob.repositoryId);
    if (!repository) {
      throw new Error(`Repository ${reviewJob.repositoryId} was not found`);
    }

    const provider = this.resolveProvider(input.provider);
    const model = input.model ?? DEFAULT_MODELS[provider.provider];
    const focusAreas = input.focusAreas ?? reviewFocusAreas;

    const leaseToken = randomUUID();
    await this.reviewJobsRepository.claimLease(reviewJob.id, leaseToken);
    await this.reviewJobsRepository.updateStatus(reviewJob.id, 'chunking', {
      input: {
        ...reviewJob.input,
        reviewPipeline: {
          provider: provider.provider,
          model,
          focusAreas,
        },
      },
    });

    await this.aiReviewChunksRepository.deleteByReviewJobId(reviewJob.id);

    try {
      const executionInput: ReviewExecutionInput = {
        provider,
        model,
        files,
        focusAreas,
        maxChunkTokens: input.maxChunkTokens,
        timeoutMs: input.timeoutMs,
        requestId: input.requestId ?? reviewJob.id,
        promptVersion: 'review-v1',
      };

      const result = await this.executionEngine.execute(executionInput, {
        onStateChange: async (state: 'chunking' | 'analyzing' | 'summarizing') => {
          await this.reviewJobsRepository.updateStatus(reviewJob.id, state, {
            leaseToken,
          });
        },
        onChunkResult: async (chunkResult: ReviewChunkResult) => {
          await this.aiReviewChunksRepository.upsertForReviewJob({
            reviewJobId: reviewJob.id,
            pullRequestId: reviewJob.pullRequestId,
            repositoryId: reviewJob.repositoryId,
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
      });

      const completed = await this.reviewJobsRepository.updateStatus(reviewJob.id, 'completed', {
        completedAt: new Date(),
        output: {
          ...result,
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

      return result;
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

  private parseJobInput(reviewJob: ReviewJob): ReviewJobInputPayload & { readonly files: ReviewFileDiff[] } {
    const input = isRecord(reviewJob.input) ? (reviewJob.input as ReviewJobInputPayload) : {};
    const files = Array.isArray(input.files) ? normalizeReviewFiles(input.files) : [];

    return {
      ...input,
      files,
    };
  }

  private resolveProvider(providerName?: AIProviderName): AIProvider {
    const resolvedProvider = providerName ?? this.resolveDefaultProviderName();
    const cacheKey = resolvedProvider;
    const cached = this.providerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const provider = this.createProvider(resolvedProvider);
    this.providerCache.set(cacheKey, provider);
    return provider;
  }

  private resolveDefaultProviderName(): AIProviderName {
    const configuredProvider = toStringValue(process.env.AI_REVIEW_PROVIDER);
    if (configuredProvider === 'openai' || configuredProvider === 'anthropic' || configuredProvider === 'gemini') {
      return configuredProvider;
    }

    if (toStringValue(process.env.OPENAI_API_KEY) !== undefined) {
      return 'openai';
    }

    if (toStringValue(process.env.GEMINI_API_KEY) !== undefined) {
      return 'gemini';
    }

    if (toStringValue(process.env.ANTHROPIC_API_KEY) !== undefined) {
      return 'anthropic';
    }

    throw new Error('No review AI provider is configured');
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
}
