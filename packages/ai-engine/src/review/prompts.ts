import type { AIMessage, AIProviderRequest, AIResponseFormat } from '../providers/types.js';
import type { ReviewChunk, ReviewFocusArea } from './types.js';

export const REVIEW_PROMPT_VERSION = 'review-v1';

const focusGuidance: Record<ReviewFocusArea, string> = {
  security: 'Prioritize authentication, authorization, injection, data exposure, unsafe deserialization, secrets handling, and trust-boundary violations.',
  performance: 'Prioritize avoidable CPU, memory, I/O, network, and concurrency costs, repeated work, large payload handling, and algorithmic complexity.',
  maintainability: 'Prioritize duplication, unclear abstractions, poor naming, brittle coupling, missing tests, and code that will be difficult to extend safely.',
  'bug-risk': 'Prioritize edge cases, race conditions, null or undefined handling, incorrect assumptions, off-by-one errors, state transitions, and regression risk.',
};

const reviewSchemaInstruction = [
  'Return a single JSON object with this shape:',
  '{"summary": string, "findings": [{"severity": "info" | "warning" | "critical", "title": string, "summary": string, "rationale"?: string, "filePath"?: string, "lineStart"?: number, "lineEnd"?: number, "suggestion"?: string, "confidence"?: number, "tags"?: string[]}]}',
  'Keep findings actionable and concise.',
  'If there are no findings, return an empty findings array and a short summary.',
].join('\n');

export interface ReviewPromptInput {
  readonly focusArea: ReviewFocusArea;
  readonly chunk: ReviewChunk;
  readonly repositoryFullName?: string;
  readonly pullRequestNumber?: number;
  readonly pullRequestTitle?: string;
  readonly pullRequestBody?: string | null;
}

export interface ReviewPromptResult {
  readonly messages: ReadonlyArray<AIMessage>;
  readonly responseFormat: AIResponseFormat;
  readonly promptVersion: string;
}

const buildUserPrompt = (input: ReviewPromptInput): string => {
  const pullRequestContext = [
    input.repositoryFullName === undefined ? null : `Repository: ${input.repositoryFullName}`,
    input.pullRequestNumber === undefined ? null : `Pull request: #${input.pullRequestNumber}`,
    input.pullRequestTitle === undefined ? null : `Title: ${input.pullRequestTitle}`,
    input.pullRequestBody === undefined || input.pullRequestBody === null || input.pullRequestBody.trim().length === 0
      ? null
      : `Description:\n${input.pullRequestBody.trim()}`,
  ]
    .filter((value): value is string => value !== null)
    .join('\n\n');

  return [
    `Review focus: ${input.focusArea}`,
    focusGuidance[input.focusArea],
    pullRequestContext.length > 0 ? pullRequestContext : null,
    `Chunk path: ${input.chunk.sourcePath}`,
    `Chunk lines: ${input.chunk.lineStart}-${input.chunk.lineEnd}`,
    `Estimated tokens: ${input.chunk.tokenCount}`,
    'Review the following diff chunk and report only issues that are relevant to this focus area.',
    'Diff chunk:\n```diff\n' + input.chunk.content + '\n```',
    reviewSchemaInstruction,
  ]
    .filter((value): value is string => value !== null)
    .join('\n\n');
};

export const buildReviewPrompt = (input: ReviewPromptInput): ReviewPromptResult => ({
  messages: [
    {
      role: 'system',
      content: [
        'You are a senior staff-level code reviewer for a production software platform.',
        'Be precise, conservative, and specific.',
        'Never invent line numbers or file paths.',
        'Prefer high-signal findings over a long list of low-value comments.',
      ].join(' '),
    },
    {
      role: 'user',
      content: buildUserPrompt(input),
    },
  ],
  responseFormat: { type: 'json_object' },
  promptVersion: REVIEW_PROMPT_VERSION,
});
