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

const splitByLines = (content: string, maxTokensPerChunk: number, maxCharactersPerChunk: number): Array<{ content: string; lineStart: number; lineEnd: number; tokenCount: number }> => {
  const lines = content.split(/\r?\n/);
  const chunks: Array<{ content: string; lineStart: number; lineEnd: number; tokenCount: number }> = [];
  let startLine = 1;
  let buffer: string[] = [];
  let bufferTokens = 0;
  let bufferCharacters = 0;

  const flush = (endLine: number): void => {
    if (buffer.length === 0) {
      return;
    }

    const chunkContent = buffer.join('\n');
    chunks.push({
      content: chunkContent,
      lineStart: startLine,
      lineEnd: endLine,
      tokenCount: estimateTokenCount(chunkContent),
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

    const wouldOverflow =
      buffer.length > 0 &&
      (bufferTokens + lineTokens > maxTokensPerChunk || bufferCharacters + lineCharacters > maxCharactersPerChunk);

    if (wouldOverflow) {
      flush(index);
    }

    buffer.push(line);
    bufferTokens += lineTokens;
    bufferCharacters += lineCharacters;

    const isLastLine = index === lines.length - 1;
    const isOversizedSingleLine = buffer.length === 1 && (bufferTokens > maxTokensPerChunk || bufferCharacters > maxCharactersPerChunk);

    if (isLastLine || isOversizedSingleLine) {
      flush(index + 1);
    }
  }

  return chunks;
};

export const chunkReviewFiles = (
  files: ReadonlyArray<ReviewFileDiff>,
  options: ReviewChunkingOptions,
): ReviewChunk[] => {
  const maxTokensPerChunk = Math.max(1, options.maxTokensPerChunk);
  const maxCharactersPerChunk = options.maxCharactersPerChunk ?? maxTokensPerChunk * 4;
  const chunks: ReviewChunk[] = [];

  for (const file of files) {
    if (file.isBinary || file.diff.length === 0) {
      continue;
    }

    const tokenCount = estimateTokenCount(file.diff);
    if (tokenCount <= maxTokensPerChunk && file.diff.length <= maxCharactersPerChunk) {
      const chunk: ReviewChunk = {
        chunkIndex: chunks.length,
        sourcePath: file.path,
        content: file.diff,
        tokenCount,
        lineStart: 1,
        lineEnd: Math.max(1, file.diff.split(/\r?\n/).length),
        ...(file.language === undefined ? {} : { fileLanguage: file.language }),
      };

      chunks.push(chunk);
      continue;
    }

    const splitChunks = splitByLines(file.diff, maxTokensPerChunk, maxCharactersPerChunk);
    for (const splitChunk of splitChunks) {
      const chunk: ReviewChunk = {
        chunkIndex: chunks.length,
        sourcePath: file.path,
        content: splitChunk.content,
        tokenCount: splitChunk.tokenCount,
        lineStart: splitChunk.lineStart,
        lineEnd: splitChunk.lineEnd,
        ...(file.language === undefined ? {} : { fileLanguage: file.language }),
      };

      chunks.push(chunk);
    }
  }

  return chunks.map((chunk, index) => ({ ...chunk, chunkIndex: index }));
};
