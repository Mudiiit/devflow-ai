import type { GitHubPullRequestFile, ReviewableFileDiff } from './types.js';

const joinLines = (lines: ReadonlyArray<string>): string => lines.join('\n');

const buildHeaderLines = (file: GitHubPullRequestFile): string[] => {
  const beforePath = file.previous_filename ?? file.filename;

  return [
    `diff --git a/${beforePath} b/${file.filename}`,
    `--- a/${beforePath}`,
    `+++ b/${file.filename}`,
  ];
};

const buildPlaceholderDiff = (file: GitHubPullRequestFile, reason: string): string => {
  return joinLines([
    ...buildHeaderLines(file),
    `@@ changes: ${file.changes}, additions: ${file.additions}, deletions: ${file.deletions} @@`,
    reason,
  ]);
};

export const normalizePullRequestFiles = (files: ReadonlyArray<GitHubPullRequestFile>): ReviewableFileDiff[] => {
  const diffs: ReviewableFileDiff[] = [];

  for (const file of files) {
    const previousPath = file.previous_filename?.trim();
    const patch = file.patch?.trim();
    const hasPatch = patch !== undefined && patch.length > 0;
    const kind: ReviewableFileDiff['kind'] = hasPatch ? 'patch' : file.changes > 0 ? 'binary' : 'skipped';
    const diff = hasPatch
      ? patch
      : buildPlaceholderDiff(
        file,
        kind === 'binary'
          ? 'Binary or generated content was omitted by the GitHub API response.'
          : 'GitHub did not include a patch for this file, so it will be reviewed as skipped context only.',
      );

    diffs.push({
      path: file.filename,
      ...(previousPath === undefined ? {} : { previousPath }),
      status: file.status,
      kind,
      diff,
      summary: `${file.status} file${previousPath === undefined ? '' : ` from ${previousPath}`} with ${file.additions} additions, ${file.deletions} deletions, and ${file.changes} total changes`,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      isBinary: !hasPatch && kind === 'binary',
      isSkipped: !hasPatch && kind === 'skipped',
    });
  }

  return diffs;
};
