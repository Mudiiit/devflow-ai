import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { expand } from 'dotenv-expand';

export interface ParseEnvOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  envFileNames?: readonly string[];
  loadEnvFiles?: boolean;
}

function getDefaultEnvFileNames(nodeEnv: string | undefined): string[] {
  const fileNames = ['.env', '.env.local'];

  if (nodeEnv && nodeEnv !== 'test') {
    fileNames.push(`.env.${nodeEnv}`, `.env.${nodeEnv}.local`);
  }

  return fileNames;
}

function loadEnvFile(filePath: string, processEnv: NodeJS.ProcessEnv): void {
  if (!existsSync(filePath)) {
    return;
  }

  const dotenvProcessEnv = processEnv as Record<string, string>;
  const configResult = loadDotenv({ path: filePath, processEnv: dotenvProcessEnv });

  if (configResult.error) {
    throw configResult.error;
  }

  expand(configResult as Parameters<typeof expand>[0]);
}

export function parseEnv(options: ParseEnvOptions = {}): NodeJS.ProcessEnv {
  const {
    cwd = process.cwd(),
    env = process.env,
    envFileNames = getDefaultEnvFileNames(env.NODE_ENV),
    loadEnvFiles = true,
  } = options;

  const parsedEnv: NodeJS.ProcessEnv = { ...env };

  if (!loadEnvFiles) {
    return parsedEnv;
  }

  for (const envFileName of envFileNames) {
    const filePath = resolve(cwd, envFileName);
    loadEnvFile(filePath, parsedEnv);
  }

  return parsedEnv;
}

export { getDefaultEnvFileNames };