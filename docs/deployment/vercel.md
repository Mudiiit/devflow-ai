# Vercel Deployment Guide

This document describes a recommended Vercel configuration for deploying the `apps/web` Next.js frontend from the DevFlow AI monorepo and notes for deploying the API and worker services for a stable production/demo environment.

## Quick summary

- Deploy `apps/web` to Vercel (static/ISR/SSR optimized hosting).
- Deploy `apps/api` and `apps/worker` to an always-on host (container platform, Render, Fly, or Kubernetes). The API and worker are long-running Node services and are not a 1:1 fit for Vercel serverless functions.

---

## Vercel project settings (recommended)

- Project Root: repository root (preferred) — this allows Vercel to install workspace dependencies and run filtered builds.
- Framework Preset: Next.js (auto-detected)
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm -w --filter web build`
- Output Directory: leave blank (Vercel detects Next.js output)
- Environment: set required env vars in Vercel UI (see below)
- Node Version: set to `22.x` if available; if not, use `18.x` and see Node guidance below
- Ignore Build Step: leave disabled

If you prefer to set Project Root to `apps/web` (alternate):

- Install Command: `pnpm -w install --frozen-lockfile`
- Build Command: `pnpm --filter web build`

Note: the `-w` flag makes pnpm operate at workspace level so shared packages resolve.

---

## Required environment variables (copy to Vercel — values explained below)

Common variables used across apps. Only set the ones relevant to the service being deployed.

- For `apps/web` (frontend):
  - `NEXT_PUBLIC_API_URL` — full URL to your deployed API on Render; browser requests go through the same-origin proxy at `/api/backend`, but server components and route handlers still need the direct API URL (e.g., `https://devflow-ai-api.onrender.com`)
  - `NEXT_PUBLIC_APP_URL` — public web URL (e.g., `https://app.devflow.example.com`)
  - `NEXTAUTH_URL` — same public web URL; keep it aligned with the frontend origin used by the API for OAuth callbacks and redirects
  - `NEXTAUTH_SECRET` — >= 32 chars for NextAuth session and callback integrity
  - `GITHUB_CLIENT_ID` — GitHub OAuth app client id used by NextAuth GitHub provider
  - `GITHUB_CLIENT_SECRET` — GitHub OAuth app client secret used by NextAuth GitHub provider
  - `NEXT_PUBLIC_APP_NAME` — display name used in meta/UI

- For `apps/api` (server; deploy off-Vercel):
  - `DATABASE_URL` — production Postgres URL
  - `JWT_SECRET` — >= 32 chars
  - `SECRET_ENCRYPTION_KEY` — >= 32 chars (if in use)
  - `NEXTAUTH_SECRET` — >= 32 chars (if using NextAuth flows)
  - `REDIS_URL` — required if using job queues (BullMQ)
  - GitHub/App credentials: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`
  - `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (as applicable)
  - Observability: `SENTRY_DSN`, `OTEL_COLLECTOR_URL`

- For `apps/worker` (background jobs; deploy off-Vercel):
  - Same core credentials as API: `DATABASE_URL`, `REDIS_URL`, AI provider keys, GitHub app keys, tracing and Sentry

Security note: always mark production secrets as Environment Variables in Vercel (set scope to Production and Preview appropriately). Do not commit secrets to source control.

---

## API / backend deployment notes

- The API and worker are designed as always-on Node services (NestJS). Recommended hosting options:
  - Render (services) — fast setup for Postgres + Redis and web services
  - Fly.io — simple containers with persistent storage and autoscaling
  - Kubernetes / EKS / GKE — for production-grade orchestration
  - AWS ECS / Fargate — managed container deploys

- When deploying the API:
  - Ensure `DATABASE_URL` points to a managed Postgres (RDS, Neon, Supabase, etc.)
  - Use connection pooling (pgbouncer) or a serverless-friendly Postgres provider if needed
  - Configure health/readiness endpoints (the repo includes `infra/scripts/verify-deployment.js` to perform post-deploy verification)
  - Set `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` to the Vercel frontend origin, not `localhost`, so `SameSite=None` cookies are emitted for the cross-origin auth session

---

## Node.js version guidance

- The repo declares a Node engine `>=22.0.0` at the root. Vercel may not support Node 22 at all times.
- Recommended options:
  1. If Vercel supports Node 22, set Node in Project Settings to `22.x`.
  2. If not available, use Node `18.x` on Vercel and consider updating the `engines` field later (this is a repo change — optional).
  3. Deploy API/worker as containers if you need a specific Node runtime.

---

## GitHub App private key handling

- The code normalizes private keys with `normalizePrivateKey(privateKey)` which converts `\n` sequences to real newlines.
- Recommended secrets strategy on Vercel:
  - Use Vercel Environment Variables to store `GITHUB_APP_PRIVATE_KEY`. When entering the key into the UI, paste the PEM including real newlines if the UI supports it.
  - If Vercel UI strips newlines, store the key with `\n` sequences and the repo's `normalizePrivateKey` will convert them to real newlines at runtime.
  - Alternatively, store a base64-encoded PEM and decode it in your runtime (requires a small code change); this is only recommended if you have issues with newline preservation.

Security tip: rotate private keys and restrict GitHub App access to only the required organizations and repos.

---

## Production deployment checklist

Before promoting to production, verify the following:

1. Environment variables: all required values set in Production scope (DB, secrets, GitHub app keys, AI provider keys).
2. Database migrations applied successfully (run migration job from your CI or container image).
3. Observability: OTLP or Sentry endpoints configured and receiving data.
4. Rate limits and retries configured for third-party APIs (GitHub, LLM providers).
5. HTTPS and TLS configured for frontend and API.
6. CORS origins set to production frontend URL(s) (the API uses `NEXTAUTH_URL` to validate origins).
7. Backups and monitoring alerts in place for DB and Redis.
8. Smoke test: run `infra/scripts/verify-deployment.js` against deployed endpoints.

---

## Common deployment failure troubleshooting

- Build fails (pnpm workspace errors): ensure the Install Command runs with `-w` or from repo root so workspace packages install.
- Missing runtime envs: Vercel build or runtime errors complaining about `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, or `NEXTAUTH_SECRET` — add them to the Vercel env list.
- Auth works in SSR but not in the browser: confirm the frontend is calling the same-origin proxy (`/api/backend/*`) and that `NEXT_PUBLIC_API_URL` points to the Render URL used by that proxy.
- GitHub private key errors (`createPrivateKey` failures): check newline handling (use `\n` escapes or paste full PEM with newlines).
- LLM provider auth errors: verify API keys and provider availability; add exponential backoff for quota errors.
- DB connection/SSL: if using managed Postgres (Neon/Supabase), you may need `rejectUnauthorized: false` handling — the code already attempts to auto-detect some managed providers but confirm connectivity.

---

## Recommended architecture (text diagram)

```
                 +-------------+              +----------------+
   GitHub PR --> | Webhook/API | --> Queue --> | Worker (AI)    | --> AI Providers
                 | (apps/api)  |              | (apps/worker)  |
                 +-----+-------+              +--------+-------+
                       |                                |
                       |                                v
                       |                         +--------------+
                       v                         | Database (PG) |
                 +-------------+                  +--------------+
                 | Frontend    | (apps/web on Vercel)
                 +-------------+

Notes:
- Frontend runs on Vercel (fast CDN, SSR/ISR where applicable).
- API and Worker run on an always-on platform and share DB/Redis.
```

---

## Final notes

- This guide focuses on deploying the frontend to Vercel while keeping long-running services on a separate host. That setup is the most reliable for demos and production.
- If you'd like, I can add a sample `vercel.json` or a GitHub Actions workflow that builds `apps/web` and runs `infra/scripts/verify-deployment.js` against a staging endpoint after deployment.
