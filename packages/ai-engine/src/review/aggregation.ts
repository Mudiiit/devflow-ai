import type { ReviewAggregationResult, ReviewCategory, ReviewChunkResult, ReviewFinding, ReviewSeverity } from './types.js';

const severityRank: Record<ReviewSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

const severityWeight: Record<ReviewSeverity, number> = {
  info: 1,
  warning: 3,
  critical: 6,
};

const categorySeed: Record<ReviewCategory, number> = {
  security: 0,
  'bug-detection': 0,
  maintainability: 0,
  performance: 0,
  architecture: 0,
};

const DEFAULT_CONFIDENCE = 0.55;
const MIN_CONFIDENCE = 0.35;
const MIN_CRITICAL_CONFIDENCE = 0.25;

const normalizeTitleKey = (title: string): string => {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
};

const normalizeFindingKey = (finding: ReviewFinding): string => {
  const filePath = finding.filePath ?? '';
  return `${finding.category}:${filePath}:${normalizeTitleKey(finding.title)}`;
};

const normalizeConfidence = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_CONFIDENCE;
  }

  return Math.min(1, Math.max(0, value));
};

const normalizeFinding = (finding: ReviewFinding): ReviewFinding => {
  const confidence = normalizeConfidence(finding.confidence);
  return confidence === finding.confidence ? finding : { ...finding, confidence };
};

const toAnchorLine = (finding: ReviewFinding): number => {
  return finding.lineStart ?? finding.lineEnd ?? 0;
};

const isNearLine = (left: ReviewFinding, right: ReviewFinding, window = 3): boolean => {
  return Math.abs(toAnchorLine(left) - toAnchorLine(right)) <= window;
};

const shouldSuppressFinding = (finding: ReviewFinding): boolean => {
  const confidence = normalizeConfidence(finding.confidence);

  if (finding.severity === 'critical') {
    return confidence < MIN_CRITICAL_CONFIDENCE;
  }

  if (confidence < MIN_CONFIDENCE) {
    return true;
  }

  if (!finding.filePath && finding.severity === 'info' && confidence < 0.6) {
    return true;
  }

  return false;
};

const mergeFindings = (left: ReviewFinding, right: ReviewFinding): ReviewFinding => {
  const leftConfidence = normalizeConfidence(left.confidence);
  const rightConfidence = normalizeConfidence(right.confidence);
  const preferRight = rightConfidence >= leftConfidence;
  const pick = <T>(leftValue: T | undefined, rightValue: T | undefined): T | undefined => {
    if (preferRight) {
      return rightValue ?? leftValue;
    }

    return leftValue ?? rightValue;
  };

  const lineStartValues = [left.lineStart, right.lineStart].filter((value): value is number => value !== undefined);
  const lineEndValues = [left.lineEnd, right.lineEnd].filter((value): value is number => value !== undefined);
  const mergedTags = Array.from(new Set([...(left.tags ?? []), ...(right.tags ?? [])]));
  const rationale = pick(left.rationale, right.rationale);
  const filePath = pick(left.filePath, right.filePath);
  const suggestion = pick(left.suggestion, right.suggestion);

  return {
    severity: severityRank[right.severity] > severityRank[left.severity] ? right.severity : left.severity,
    category: left.category,
    title: preferRight ? right.title : left.title,
    summary: pick(left.summary, right.summary) ?? left.summary,
    ...(rationale === undefined ? {} : { rationale }),
    ...(filePath === undefined ? {} : { filePath }),
    ...(lineStartValues.length === 0 ? {} : { lineStart: Math.min(...lineStartValues) }),
    ...(lineEndValues.length === 0 ? {} : { lineEnd: Math.max(...lineEndValues) }),
    ...(suggestion === undefined ? {} : { suggestion }),
    confidence: Math.max(leftConfidence, rightConfidence),
    tags: mergedTags,
  };
};

const buildSummary = (input: {
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly severityCounts: Record<ReviewSeverity, number>;
  readonly categoryCounts: Record<ReviewCategory, number>;
  readonly riskScore: number;
  readonly confidenceScore: number;
}): string => {
  if (input.findings.length === 0) {
    return `No high-confidence issues were identified. Risk score ${input.riskScore}/100.`;
  }

  const topCategories = Object.entries(input.categoryCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([category]) => category);

  const categorySummary = topCategories.length > 0 ? ` Top areas: ${topCategories.join(', ')}.` : '';
  const severitySummary = `Critical ${input.severityCounts.critical}, warning ${input.severityCounts.warning}, info ${input.severityCounts.info}.`;

  return `Found ${input.findings.length} findings (${severitySummary}) Risk score ${input.riskScore}/100, confidence ${input.confidenceScore}/100.${categorySummary}`;
};

const sumSeverity = (counts: Record<ReviewSeverity, number>, severity: ReviewSeverity): void => {
  counts[severity] += 1;
};

const sumCategory = (counts: Record<ReviewCategory, number>, category: ReviewCategory): void => {
  counts[category] += 1;
};

export const aggregateReviewResults = (chunkResults: ReadonlyArray<ReviewChunkResult>): ReviewAggregationResult => {
  const counts: Record<ReviewSeverity, number> = { info: 0, warning: 0, critical: 0 };
  const categoryCounts: Record<ReviewCategory, number> = { ...categorySeed };
  const deduped = new Map<string, ReviewFinding[]>();
  let totalTokens = 0;
  let suppressedFindings = 0;

  for (const chunkResult of chunkResults) {
    totalTokens += chunkResult.usage.totalTokens;
    for (const finding of chunkResult.findings) {
      const normalized = normalizeFinding(finding);
      if (shouldSuppressFinding(normalized)) {
        suppressedFindings += 1;
        continue;
      }

      const key = normalizeFindingKey(normalized);
      const bucket = deduped.get(key);

      if (bucket === undefined) {
        deduped.set(key, [normalized]);
        continue;
      }

      const matchIndex = bucket.findIndex((existing) => isNearLine(existing, normalized));
      if (matchIndex >= 0) {
        bucket[matchIndex] = mergeFindings(bucket[matchIndex]!, normalized);
      } else {
        bucket.push(normalized);
      }
    }
  }

  const findings = [...deduped.values()].flat().sort((left, right) => {
    const severityDelta = severityRank[right.severity] - severityRank[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });

  for (const finding of findings) {
    sumSeverity(counts, finding.severity);
    sumCategory(categoryCounts, finding.category);
  }

  const overallSeverity: ReviewSeverity = counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'warning' : 'info';
  const confidenceValues = findings.map((finding) => normalizeConfidence(finding.confidence));
  const averageConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : 0.9;
  const confidenceScore = Math.round(averageConfidence * 100);
  const riskScore = Math.min(
    100,
    Math.round(
      findings.reduce((total, finding) => total + severityWeight[finding.severity] * normalizeConfidence(finding.confidence), 0) * 10,
    ),
  );
  const summary = buildSummary({
    findings,
    severityCounts: counts,
    categoryCounts,
    riskScore,
    confidenceScore,
  });

  return {
    summary,
    overallSeverity,
    findings,
    chunkResults,
    severityCounts: counts,
    categoryCounts,
    totalTokens,
    riskScore,
    confidenceScore,
    suppressedFindings,
  };
};
