import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(message: string, public readonly issues: string[]) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

export interface ValidateEnvOptions {
  scope?: 'client' | 'server';
}

function formatIssuePath(path: Array<string | number>): string {
  return path.length > 0 ? path.join('.') : 'root';
}

export function validateEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  env: unknown,
  options: ValidateEnvOptions = {},
): z.infer<TSchema> {
  const result = schema.safeParse(env);

  if (result.success) {
    return Object.freeze(result.data) as z.infer<TSchema>;
  }

  const scope = options.scope ?? 'server';
  const issues = result.error.issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`);

  throw new EnvValidationError(`Invalid ${scope} environment configuration`, issues);
}