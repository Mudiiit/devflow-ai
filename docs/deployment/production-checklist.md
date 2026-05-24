# Production Deployment Checklist

Before deploying to production, ensure the following:

- Environment variables set (`DATABASE_URL`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `REDIS_URL`).
- Run DB migrations: `pnpm --filter @devflow/database migrate:prod`.
- Build images: `pnpm build` or CI pipeline.
- Start services with `docker compose -f docker-compose.prod.yml up -d --build`.
- Run `pnpm validate:env --strict` to enforce production-only checks.
- Run `pnpm verify:deployment` to validate `/health/ready` on services (requires reachable services).
- Monitor logs for startup errors and fix any connectivity issues (DB, Redis, GitHub App keys).

