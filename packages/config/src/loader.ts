import { z } from 'zod';
import { parseEnv, type ParseEnvOptions } from './utils/parse-env.js';
import { validateEnv, type ValidateEnvOptions } from './utils/validate-env.js';

export interface LoadEnvOptions<TSchema extends z.ZodTypeAny>
  extends Omit<ParseEnvOptions, 'env'>,
    ValidateEnvOptions {
  schema: TSchema;
  env?: NodeJS.ProcessEnv;
}

export function loadEnv<TSchema extends z.ZodTypeAny>(options: LoadEnvOptions<TSchema>): z.infer<TSchema> {
  const { schema, env, scope, ...parseOptions } = options;
  const parsedEnv = parseEnv({
    ...parseOptions,
    ...(env ? { env } : {}),
  });

  return validateEnv(schema, parsedEnv, scope ? { scope } : {});
}