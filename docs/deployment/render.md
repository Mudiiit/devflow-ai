# Render Deployment Guide

This guide deploys only the NestJS API to Render. The Next.js frontend stays on Vercel, and the worker remains a separate service for later deployment.

## What Render should deploy

Deploy only `apps/api` as a single long-running web service.

Do not point Render at the monorepo root with a generic `pnpm build` command, because that will run the whole Turbo pipeline and can attempt to build the frontend.

---

## Recommended Render blueprint

Use the root [render.yaml](../../render.yaml) file in this repository. It is configured for the API only:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @devflow/database migrate:prod && pnpm --filter api... build`
- Start command: `pnpm --filter api start:prod`
- Health check path: `/health/ready`
- Runtime: Node
- Root directory: repository root

If you prefer the Render dashboard instead of a blueprint, use the same build/start commands and keep the service scoped to the API.

---

## Render environment variables

Set these in the Render API service.

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - at least 32 characters
- `SECRET_ENCRYPTION_KEY` - at least 32 characters
- `REDIS_URL` - Redis / BullMQ connection string
- `NEXTAUTH_URL` - the public frontend URL on Vercel, for example `https://app.devflow.example.com`
- `NEXT_PUBLIC_APP_URL` - same public frontend URL, used by billing and redirect helpers
- `GITHUB_APP_ID` - GitHub App id
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private key PEM
- `GITHUB_CLIENT_ID` - GitHub OAuth client id
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- `GITHUB_WEBHOOK_SECRET` - GitHub webhook secret

### Recommended

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `SENTRY_DSN`
- `OTEL_COLLECTOR_URL`
- `LOG_LEVEL`
- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX_REQUESTS`
- `API_MAX_BODY_BYTES`
- `API_IDEMPOTENCY_TTL_SECONDS`
- `REVIEW_QUEUE_ATTEMPTS`
- `REVIEW_QUEUE_BACKOFF_MS`

### Optional for future API routing

- `RENDER_EXTERNAL_URL` is provided by Render automatically and is used by the API to build its own OAuth callback URL.
- `API_PUBLIC_URL` can be set manually if you are not using Render's automatic public URL.
- `NEXT_PUBLIC_API_URL` is not required on Render, but you may set it to the API public URL if you want to reuse the same origin string in scripts or external tooling.

---

## API command sequence on Render

Use this exact setup:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @devflow/database migrate:prod && pnpm --filter api... build`
- Start command: `pnpm --filter api start:prod`
- Health check: `/health/ready`

The API reads `process.env.PORT` at runtime, so Render should assign the port automatically.

---

## GitHub OAuth settings

The GitHub OAuth callback route for user login is handled by NextAuth on the frontend.

Use this callback URL in your GitHub OAuth app configuration:

- Production: `https://devflow-ai-web.vercel.app/api/auth/callback/github`
- Local development: `http://localhost:3000/api/auth/callback/github`

The frontend login button should trigger NextAuth sign-in (`signIn('github')`), not the API `/auth/github/login` endpoint.

---

## CORS and browser-origin settings

For browser traffic, the API must allow your Vercel frontend origin.

Set both of these to the same public frontend URL:

- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

That origin is used for CORS, login redirects, and billing return URLs.

---

## Worker deployment later

The worker is intentionally not included in the Render API blueprint.

When you are ready to deploy it separately, use the same repo with:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter worker build`
- Start command: `pnpm --filter worker start:prod`
- The same database, Redis, GitHub, and AI provider env vars as the API

That keeps the worker independently deployable without coupling it to the API release process.
