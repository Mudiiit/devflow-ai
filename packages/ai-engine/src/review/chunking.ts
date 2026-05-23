import type { ReviewChunk, ReviewFileDiff } from './types.js';

export interface ReviewChunkingOptions {
  readonly maxTokensPerChunk: number;
  readonly maxCharactersPerChunk?: number;
}

export const estimateTokenCount = (content: string): number => {
  if (content.length === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(content.length / 4));
};

interface ChunkSection {
  readonly content: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly tokenCount: number;
}

const isDiffHeaderLine = (line: string): boolean => {
  return line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ');
};

const splitLinesByBudget = (
  lines: ReadonlyArray<string>,
  lineOffset: number,
  maxTokensPerChunk: number,
  maxCharactersPerChunk: number,
): ChunkSection[] => {
  const chunks: ChunkSection[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let bufferCharacters = 0;
  let startLine = lineOffset;

  const flush = (endLine: number): void => {
    if (buffer.length === 0) {
      return;
    }

    const content = buffer.join('\n');
    chunks.push({
      content,
      lineStart: startLine,
      lineEnd: endLine,
      tokenCount: estimateTokenCount(content),
    });

    buffer = [];
    bufferTokens = 0;
    bufferCharacters = 0;
    startLine = endLine + 1;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineTokens = estimateTokenCount(line);
    const lineCharacters = line.length + 1;
    const lineNumber = lineOffset + index;

    const wouldOverflow =
      buffer.length > 0 &&
      (bufferTokens + lineTokens > maxTokensPerChunk || bufferCharacters + lineCharacters > maxCharactersPerChunk);

    if (wouldOverflow) {
      flush(lineNumber - 1);
    }

    buffer.push(line);
    bufferTokens += lineTokens;
    bufferCharacters += lineCharacters;

    const isLastLine = index === lines.length - 1;
    const isOversizedSingleLine = buffer.length === 1 && (bufferTokens > maxTokensPerChunk || bufferCharacters > maxCharactersPerChunk);

    if (isLastLine || isOversizedSingleLine) {
      flush(lineNumber);
    }
  }

  return chunks;
};

const buildBinaryChunk = (file: ReviewFileDiff, chunkIndex: number): ReviewChunk => {
  const content = [
    `diff --git a/${file.previousPath ?? file.path} b/${file.path}`,
    `File: ${file.path}`,
    file.previousPath === undefined ? null : `Previous path: ${file.previousPath}`,
    `Status: ${file.status}`,
    `Kind: ${file.kind}`,
    file.summary,
    file.isBinary === true
      ? 'Binary content omitted from the GitHub diff response.'
      : 'GitHub did not include a patch for this file.',
  ]
    .filter((value): value is string => value !== null)
    .join('\n');

  return {
    chunkIndex,
    sourcePath: file.path,
    ...(file.previousPath === undefined ? {} : { previousPath: file.previousPath }),
    fileStatus: file.status,
    fileKind: file.kind,
    content,
    tokenCount: estimateTokenCount(content),
    lineStart: 1,
    lineEnd: 1,
    ...(file.language === undefined ? {} : { fileLanguage: file.language }),
  };
};

const splitPatchFile = (
  file: ReviewFileDiff,
  maxTokensPerChunk: number,
  maxCharactersPerChunk: number,
  chunkIndexOffset: number,
): ReviewChunk[] => {
  const lines = file.diff.split(/\r?\n/);
  const headerLines: string[] = [];
  const bodyLines: string[] = [];
  let foundBody = false;

  for (const line of lines) {
    if (!foundBody && (isDiffHeaderLine(line) || line.startsWith('@@ '))) {
      headerLines.push(line);
      if (line.startsWith('@@ ')) {
        foundBody = true;
      }
      continue;
    }

    foundBody = true;
    bodyLines.push(line);
  }

  const fileChunks: ReviewChunk[] = [];
  const emitChunk = (content: string, lineStart: number, lineEnd: number): void => {
    fileChunks.push({
      chunkIndex: chunkIndexOffset + fileChunks.length,
      sourcePath: file.path,
      ...(file.previousPath === undefined ? {} : { previousPath: file.previousPath }),
      fileStatus: file.status,
      fileKind: file.kind,
      content,
      tokenCount: estimateTokenCount(content),
      lineStart,
      lineEnd,
      ...(file.language === undefined ? {} : { fileLanguage: file.language }),
    });
  };

  if (lines.length === 0) {
    return [buildBinaryChunk(file, chunkIndexOffset)];
  }

  const fullContent = file.diff;
  if (estimateTokenCount(fullContent) <= maxTokensPerChunk && fullContent.length <= maxCharactersPerChunk) {
    emitChunk(fullContent, 1, Math.max(1, lines.length));
    return fileChunks;
  }

  if (bodyLines.length === 0) {
    const splitSections = splitLinesByBudget(lines, 1, maxTokensPerChunk, maxCharactersPerChunk);
    for (const section of splitSections) {
      emitChunk(section.content, section.lineStart, section.lineEnd);
    }

    return fileChunks;
  }

  const headerContent = headerLines.join('\n');
  const headerPrefix = headerContent.length > 0 ? `${headerContent}\n` : '';
  const bodySections = splitLinesByBudget(bodyLines, headerLines.length + 1, maxTokensPerChunk, maxCharactersPerChunk);

  for (const section of bodySections) {
    emitChunk(`${headerPrefix}${section.content}`, 1, section.lineEnd);
  }

  return fileChunks;
};

export const chunkReviewFiles = (
  files: ReadonlyArray<ReviewFileDiff>,
  options: ReviewChunkingOptions,
): ReviewChunk[] => {
  const maxTokensPerChunk = Math.max(1, options.maxTokensPerChunk);
  const maxCharactersPerChunk = options.maxCharactersPerChunk ?? maxTokensPerChunk * 4;
  const chunks: ReviewChunk[] = [];

  for (const file of files) {
    const fileChunks = file.kind === 'patch'
      ? splitPatchFile(file, maxTokensPerChunk, maxCharactersPerChunk, chunks.length)
      : [buildBinaryChunk(file, chunks.length)];

    chunks.push(...fileChunks);
  }

  return chunks.map((chunk, index) => ({ ...chunk, chunkIndex: index }));
};
