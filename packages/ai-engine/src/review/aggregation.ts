import type { ReviewAggregationResult, ReviewChunkResult, ReviewFinding, ReviewSeverity } from './types.js';

const severityRank: Record<ReviewSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

const normalizeKey = (finding: ReviewFinding): string => {
  const filePath = finding.filePath ?? '';
  const lineStart = finding.lineStart ?? 0;
  const lineEnd = finding.lineEnd ?? 0;
  return `${finding.severity}:${filePath}:${lineStart}:${lineEnd}:${finding.title.trim().toLowerCase()}`;
};

const sumSeverity = (counts: Record<ReviewSeverity, number>, severity: ReviewSeverity): void => {
  counts[severity] += 1;
};

export const aggregateReviewResults = (chunkResults: ReadonlyArray<ReviewChunkResult>): ReviewAggregationResult => {
  const counts: Record<ReviewSeverity, number> = { info: 0, warning: 0, critical: 0 };
  const deduped = new Map<string, ReviewFinding>();
  let totalTokens = 0;

  for (const chunkResult of chunkResults) {
    totalTokens += chunkResult.usage.totalTokens;
    for (const finding of chunkResult.findings) {
      const key = normalizeKey(finding);
      if (!deduped.has(key)) {
        deduped.set(key, finding);
      }
      sumSeverity(counts, finding.severity);
    }
  }

  const findings = [...deduped.values()].sort((left, right) => {
    const severityDelta = severityRank[right.severity] - severityRank[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });

  const overallSeverity: ReviewSeverity = counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'warning' : 'info';

  const summary = findings.length === 0
    ? 'No actionable issues were identified across the reviewed chunks.'
    : `Found ${findings.length} actionable finding${findings.length === 1 ? '' : 's'} with highest severity ${overallSeverity}.`;

  return {
    summary,
    overallSeverity,
    findings,
    chunkResults,
    severityCounts: counts,
    totalTokens,
  };
};
