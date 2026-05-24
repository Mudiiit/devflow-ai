# Database Migrations (Drizzle)

This document explains how to run safe, production Drizzle migrations for DevFlow AI.

- Config: `packages/database/drizzle.config.ts` — validates `DATABASE_URL` via shared env schema.

- Generate a migration (dev):

  ```bash
  pnpm --filter @devflow/database db:generate
  ```

- Apply migrations (dev):

  ```bash
  pnpm --filter @devflow/database db:migrate
  ```

- Apply migrations (production - recommended):

  The production runner validates required env vars and runs the compiled Node script.

  ```bash
  # Build the database package and run migrations
  pnpm --filter @devflow/database migrate:prod
  ```

- Tips:
  - Always generate migrations from a clean working tree to avoid drift.
  - Review generated SQL in `packages/database/src/migrations` before applying to prod.
  - Snapshot backups or run in a maintenance window for critical schemas.
