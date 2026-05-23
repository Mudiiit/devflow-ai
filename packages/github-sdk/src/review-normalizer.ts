import type { GitHubPullRequestFile, ReviewableFileDiff } from './types.js';

const joinLines = (lines: ReadonlyArray<string>): string => lines.join('\n');

const buildPlaceholderDiff = (file: GitHubPullRequestFile): string => {
  const beforePath = file.previous_filename ?? file.filename;

  return joinLines([
    `diff --git a/${beforePath} b/${file.filename}`,
    `--- a/${beforePath}`,
    `+++ b/${file.filename}`,
    `@@ changes: ${file.changes}, additions: ${file.additions}, deletions: ${file.deletions} @@`,
    file.patch ?? 'Patch unavailable from the GitHub API response.',
  ]);
};

export const normalizePullRequestFiles = (files: ReadonlyArray<GitHubPullRequestFile>): ReviewableFileDiff[] => {
  const diffs: ReviewableFileDiff[] = [];

  for (const file of files) {
    const patch = file.patch?.trim();
    const diff = patch && patch.length > 0 ? patch : buildPlaceholderDiff(file);

    diffs.push({
      path: file.filename,
      diff,
      isBinary: patch === undefined || patch.length === 0,
    });
  }

  return diffs;
};
