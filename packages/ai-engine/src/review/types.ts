import type { AIProviderName, AIUsage } from '../providers/types.js';

export const reviewFocusAreas = ['security', 'bug-risk', 'maintainability', 'performance', 'architectural'] as const;

export type ReviewFocusArea = (typeof reviewFocusAreas)[number];

export const reviewCategories = ['security', 'bug-detection', 'maintainability', 'performance', 'architecture'] as const;

export type ReviewCategory = (typeof reviewCategories)[number];

export const reviewLifecycleStates = ['queued', 'processing', 'chunking', 'analyzing', 'summarizing', 'completed', 'failed'] as const;

export type ReviewLifecycleState = (typeof reviewLifecycleStates)[number];

export const reviewSeverities = ['info', 'warning', 'critical'] as const;

export type ReviewSeverity = (typeof reviewSeverities)[number];

export type ReviewFileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export type ReviewFileKind = 'patch' | 'binary' | 'skipped';

export interface ReviewFileDiff {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: ReviewFileStatus;
  readonly kind: ReviewFileKind;
  readonly diff: string;
  readonly summary: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly language?: string;
  readonly isBinary?: boolean;
  readonly isSkipped?: boolean;
}

export interface ReviewChunk {
  readonly chunkIndex: number;
  readonly sourcePath: string;
  readonly previousPath?: string;
  readonly fileStatus: ReviewFileStatus;
  readonly fileKind: ReviewFileKind;
  readonly content: string;
  readonly tokenCount: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly fileLanguage?: string;
}

export interface ReviewFinding {
  readonly severity: ReviewSeverity;
  readonly category: ReviewCategory;
  readonly title: string;
  readonly summary: string;
  readonly rationale?: string;
  readonly filePath?: string;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly suggestion?: string;
  readonly confidence?: number;
  readonly tags: ReadonlyArray<string>;
}

export interface ReviewChunkResult {
  readonly chunkIndex: number;
  readonly sourcePath: string;
  readonly previousPath?: string;
  readonly fileStatus: ReviewFileStatus;
  readonly fileKind: ReviewFileKind;
  readonly content: string;
  readonly tokenCount: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly focusArea: ReviewFocusArea;
  readonly promptVersion: string;
  readonly provider: AIProviderName;
  readonly model: string;
  readonly summary: string;
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly usage: AIUsage;
  readonly rawResponseId: string;
}

export interface ReviewAggregationResult {
  readonly summary: string;
  readonly overallSeverity: ReviewSeverity;
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly chunkResults: ReadonlyArray<ReviewChunkResult>;
  readonly severityCounts: Readonly<Record<ReviewSeverity, number>>;
  readonly categoryCounts: Readonly<Record<ReviewCategory, number>>;
  readonly totalTokens: number;
  readonly riskScore: number;
  readonly confidenceScore: number;
  readonly suppressedFindings: number;
}

export interface ReviewOrchestrationResult extends ReviewAggregationResult {
  readonly status: 'completed';
  readonly chunkCount: number;
  readonly focusAreaCount: number;
  readonly generatedAt: string;
}

export interface ReviewExecutionInput {
  readonly provider: {
    readonly provider: AIProviderName;
    complete(request: import('../providers/types.js').AIProviderRequest, context?: import('../providers/types.js').AIRequestContext): Promise<import('../providers/types.js').AIProviderResponse>;
  };
  readonly model: string;
  readonly files: ReadonlyArray<ReviewFileDiff>;
  readonly focusAreas?: ReadonlyArray<ReviewFocusArea>;
  readonly maxChunkTokens?: number;
  readonly timeoutMs?: number;
  readonly requestId?: string;
  readonly promptVersion?: string;
}

export interface ReviewExecutionHooks {
  readonly onStateChange?: (state: Exclude<ReviewLifecycleState, 'queued' | 'completed' | 'failed'>) => Promise<void> | void;
  readonly onChunkResult?: (chunkResult: ReviewChunkResult) => Promise<void> | void;
}
