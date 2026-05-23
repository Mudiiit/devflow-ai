import { AIProviderError } from '../providers/errors.js';
import type { AIProviderName, AIProviderRequest, AIRequestContext } from '../providers/types.js';
import { buildIdempotencyKey } from '../providers/request-utils.js';
import { aggregateReviewResults } from './aggregation.js';
import { chunkReviewFiles } from './chunking.js';
import { buildReviewPrompt } from './prompts.js';
import type {
  ReviewChunkResult,
  ReviewExecutionHooks,
  ReviewExecutionInput,
  ReviewFinding,
  ReviewFocusArea,
  ReviewOrchestrationResult,
  ReviewSeverity,
} from './types.js';
import { reviewFocusAreas } from './types.js';

interface ReviewResponsePayload {
  readonly summary?: unknown;
  readonly findings?: unknown;
  readonly issues?: unknown;
}

const severityValues: ReadonlyArray<ReviewSeverity> = ['info', 'warning', 'critical'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isReviewSeverity = (value: unknown): value is ReviewSeverity => {
  return typeof value === 'string' && severityValues.includes(value as ReviewSeverity);
};

const isStringArray = (value: unknown): value is ReadonlyArray<string> => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

const parseResponsePayload = (content: string): ReviewResponsePayload => {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed)) {
    throw new AIProviderError('AI_RESPONSE_ERROR', 'Review response must be a JSON object', { retryable: false });
  }

  return parsed;
};

const normalizeFindings = (value: unknown): ReviewFinding[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const findings: ReviewFinding[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const severity = isReviewSeverity(item.severity) ? item.severity : 'info';
    const title = typeof item.title === 'string' && item.title.trim().length > 0 ? item.title.trim() : 'Review finding';
    const summary = typeof item.summary === 'string' && item.summary.trim().length > 0 ? item.summary.trim() : title;
    const rationale = typeof item.rationale === 'string' && item.rationale.trim().length > 0 ? item.rationale.trim() : undefined;
    const filePath = typeof item.filePath === 'string' && item.filePath.trim().length > 0 ? item.filePath.trim() : undefined;
    const lineStart = typeof item.lineStart === 'number' && Number.isFinite(item.lineStart) ? item.lineStart : undefined;
    const lineEnd = typeof item.lineEnd === 'number' && Number.isFinite(item.lineEnd) ? item.lineEnd : undefined;
    const suggestion = typeof item.suggestion === 'string' && item.suggestion.trim().length > 0 ? item.suggestion.trim() : undefined;
    const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence) ? item.confidence : undefined;
    const tags = isStringArray(item.tags) ? [...item.tags] : [];

    const finding: ReviewFinding = {
      severity,
      title,
      summary,
      tags,
      ...(rationale === undefined ? {} : { rationale }),
      ...(filePath === undefined ? {} : { filePath }),
      ...(lineStart === undefined ? {} : { lineStart }),
      ...(lineEnd === undefined ? {} : { lineEnd }),
      ...(suggestion === undefined ? {} : { suggestion }),
      ...(confidence === undefined ? {} : { confidence }),
    };

    findings.push(finding);
  }

  return findings;
};

const extractSummary = (payload: ReviewResponsePayload): string => {
  const summary = payload.summary;
  if (typeof summary === 'string' && summary.trim().length > 0) {
    return summary.trim();
  }

  return 'Review completed successfully.';
};

const toFocusAreas = (focusAreas?: ReadonlyArray<ReviewFocusArea>): ReadonlyArray<ReviewFocusArea> => {
  if (focusAreas === undefined || focusAreas.length === 0) {
    return reviewFocusAreas;
  }

  return focusAreas;
};

const toRequestId = (jobId: string, chunkIndex: number, focusArea: ReviewFocusArea): string => {
  return `${jobId}:${chunkIndex}:${focusArea}`;
};

const toIdempotencyKey = (providerName: AIProviderName, request: AIProviderRequest): string => {
  return buildIdempotencyKey(providerName, request);
};

export class ReviewExecutionEngine {
  public async execute(input: ReviewExecutionInput, hooks: ReviewExecutionHooks = {}): Promise<ReviewOrchestrationResult> {
    const focusAreas = toFocusAreas(input.focusAreas);
    const maxChunkTokens = input.maxChunkTokens ?? 2_000;

    if (hooks.onStateChange !== undefined) {
      await hooks.onStateChange('chunking');
    }

    const chunks = chunkReviewFiles(input.files, {
      maxTokensPerChunk: maxChunkTokens,
      maxCharactersPerChunk: maxChunkTokens * 8,
    });

    if (hooks.onStateChange !== undefined) {
      await hooks.onStateChange('analyzing');
    }

    const chunkResults: ReviewChunkResult[] = [];

    for (const chunk of chunks) {
      for (const focusArea of focusAreas) {
        const prompt = buildReviewPrompt({
          focusArea,
          chunk,
        });

        const request: AIProviderRequest = {
          model: input.model,
          messages: prompt.messages,
          responseFormat: prompt.responseFormat,
          maxOutputTokens: 1_500,
          temperature: 0.1,
        };

        const context: AIRequestContext = {
          requestId: input.requestId ?? toRequestId(input.provider.provider, chunk.chunkIndex, focusArea),
          idempotencyKey: toIdempotencyKey(input.provider.provider, request),
          ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
        };

        const response = await input.provider.complete(request, context);
        const payload = parseResponsePayload(response.content);
        const findings = normalizeFindings(payload.findings ?? payload.issues);
        const chunkResult: ReviewChunkResult = {
          chunkIndex: chunk.chunkIndex,
          sourcePath: chunk.sourcePath,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          focusArea,
          promptVersion: prompt.promptVersion,
          provider: response.provider,
          model: response.model,
          summary: extractSummary(payload),
          findings,
          usage: response.usage,
          rawResponseId: response.id,
        };

        chunkResults.push(chunkResult);

        if (hooks.onChunkResult !== undefined) {
          await hooks.onChunkResult(chunkResult);
        }
      }
    }

    if (hooks.onStateChange !== undefined) {
      await hooks.onStateChange('summarizing');
    }

    const aggregation = aggregateReviewResults(chunkResults);

    return {
      status: 'completed',
      chunkCount: chunks.length,
      focusAreaCount: focusAreas.length,
      generatedAt: new Date().toISOString(),
      ...aggregation,
    };
  }
}
