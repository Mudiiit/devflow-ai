import { execSync } from 'child_process';
import path from 'path';
import { loadEnv, serverEnvSchema } from '@devflow/config';

// Validate essential env vars before attempting migrations.
const envSchema = serverEnvSchema.pick({ DATABASE_URL: true });
const { DATABASE_URL } = loadEnv({ schema: envSchema, scope: 'server' });

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting migrations.');
  process.exit(1);
}

try {
  const pkgRoot = path.resolve(__dirname, '..', '..');
  // Run drizzle-kit migrate with the package-local config. Use npx to ensure
  // the local dev dependency is resolved in CI/container images.
  console.log('Running Drizzle migrations (package root: %s)...', pkgRoot);
  execSync('npx drizzle-kit migrate --config drizzle.config.ts', {
    stdio: 'inherit',
    cwd: pkgRoot,
    env: { ...process.env, DATABASE_URL },
  });
  console.log('Migrations completed successfully.');
} catch (err: any) {
  console.error('Migration run failed:', err?.message ?? err);
  process.exit(2);
}
