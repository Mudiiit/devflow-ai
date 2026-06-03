import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
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
  const migrationsDir = path.resolve(pkgRoot, 'src', 'migrations');
  const hasMigrations = existsSync(migrationsDir) && readdirSync(migrationsDir).length > 0;

  // Use migrations when they exist; otherwise push the current schema so new
  // deployments can provision an empty database from the checked-in schema.
  const command = hasMigrations
    ? 'npx drizzle-kit migrate --config drizzle.config.ts'
    : 'npx drizzle-kit push --config drizzle.config.ts';

  console.log('Running database schema sync (package root: %s)...', pkgRoot);
  execSync(command, {
    stdio: 'inherit',
    cwd: pkgRoot,
    env: { ...process.env, DATABASE_URL },
  });
  console.log('Database schema sync completed successfully.');
} catch (err: any) {
  console.error('Migration run failed:', err?.message ?? err);
  process.exit(2);
}
