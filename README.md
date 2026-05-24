# DevFlow AI

> AI-powered Pull Request Review & Engineering Intelligence

DevFlow AI helps engineering teams ship safer, higher-quality code by augmenting GitHub Pull Request reviews with automated analysis, prioritized insights, and contextual recommendations. This repository contains the monorepo for the DevFlow AI platform — a production-focused codebase intended for SaaS deployment and large-team collaboration.

<!-- Hero -->

## 🚀 Why DevFlow AI

- Faster reviews with AI-assisted suggestions and risk signals
- Continuous code health and PR quality insights across repositories
- Designed for scalable teams and enterprise deployment

---

## Contents

- Feature overview
- Architecture overview
- Screenshots (placeholders)
- Tech stack
- Monorepo layout
- Local development
- Environment variables
- Database setup
- AI review pipeline
- Observability & monitoring
- Authentication & RBAC
- CI/CD & deployment
- Scalability considerations
- Accessibility & performance notes
- Roadmap
- Recruiter-focused highlights
- Contributing
- License

---

## Feature overview

- AI-assisted PR review: automatic suggestions, risk detection, and suggested code changes.
- Review triage: prioritized PRs and signal-driven queues for maintainers.
- Health dashboards: repository-level health, trend analysis, and signal breakdowns.
- Realtime notifications: inbox with live updates and reconnect handling.
- Onboarding flows & empty-state guides for new repos.
- Premium UX: polished skeletons, motion consistency, and responsive-first design.

---

## Architecture overview

DevFlow AI is built as a modular monorepo composed of three top-level apps and shared packages:

- `apps/api` — backend services and API surface (NestJS). Handles authentication, webhooks, and the review orchestration layer.
- `apps/web` — Next.js frontend (App Router) serving the dashboard and product UI.
- `apps/worker` — background processing: long-running tasks, AI job workers, and integration handlers.
- `packages/*` — shared libraries (AI engine, database models, config, logging, tracing, etc.).

High-level flow:

1. GitHub webhook / polling triggers a PR analysis job.
2. `worker` creates an AI task and stores metadata in the database.
3. AI Engine (local package) runs model prompts and returns review suggestions.
4. Results are stored, surfaced in the UI, and optionally commented back to the PR via GitHub APIs.

---

## Screenshots

> NOTE: Replace these placeholders with production screenshots before public release.

- Dashboard overview

![Dashboard placeholder](./docs/screenshots/dashboard-placeholder.png)

- PR review detail

![PR review placeholder](./docs/screenshots/pr-review-placeholder.png)

- Mobile inbox / notifications

![Notifications placeholder](./docs/screenshots/notifications-placeholder.png)

---

## Tech stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend: NestJS (apps/api), Node.js, TypeScript
- Worker: Node.js TypeScript workers (apps/worker)
- Database: PostgreSQL (via packages/database)
- Orchestration: pnpm workspaces, Turborepo (turbo)
- Testing: Playwright for E2E, Jest for unit tests
- Observability: OpenTelemetry-compatible tracing + centralized logs

---

## Monorepo structure

Top-level layout (abridged):

```
apps/
  api/
  web/
  worker/
packages/
  ai-engine/
  database/
  config/
  logger/
  tracing/
  shared/
docs/
infra/
```

See the repository root for the full structure.

---

## Local development

Prerequisites:

- Node.js (LTS, 18+ recommended)
- pnpm (workspace-aware)
- PostgreSQL (local or Docker)
- Optional: Playwright browsers for E2E

Install dependencies:

```bash
pnpm install
```

Run typecheck and build locally (monorepo-aware):

```bash
pnpm -w build
pnpm -w run typecheck
```

Start the web app in dev mode:

```bash
# from repo root
pnpm --filter @devflow/web dev
```

Start the API and worker services in separate terminals:

```bash
pnpm --filter api dev
pnpm --filter worker dev
```

Run E2E tests (Playwright):

```bash
cd apps/web
pnpm exec playwright test --config=../../playwright.config.ts
```

---

## Environment variables

Create a `.env` file per app (or use your orchestrator). Common variables:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — frontend base URL for auth callbacks
- `NEXTAUTH_SECRET` — session encryption key
- `GITHUB_APP_ID` / `GITHUB_PRIVATE_KEY` — GitHub integration creds (if using GitHub App)
- `REDIS_URL` — optional cache/queue backend
- `SENTRY_DSN` — optional error monitoring
- `OTEL_COLLECTOR_URL` — optional tracing exporter

Do not commit secrets to source control. Use a secrets manager for production deployments.

---

## Database setup

This project expects PostgreSQL. For quick local setup using Docker:

```bash
docker run --name devflow-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=devflow -p 5432:5432 -d postgres:15
# then set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devflow
```

Run migrations (package-specific):

```bash
pnpm --filter packages/database migrate:dev
```

If you use Prisma or Drizzle in `packages/database`, consult that package's README for exact migrate/seeding commands.

---

## AI review pipeline

Overview:

- Incoming PR triggers a review job via webhook or scheduled sync.
- The job normalizes context (diffs, files, repo metadata) and queues an AI task.
- `packages/ai-engine` contains prompt templates and orchestration logic used by workers.
- Workers execute the AI task (local models or remote LLMs via configured providers) and produce structured findings.
- Findings are persisted and surfaced in the UI; optionally, a summarized comment is posted back to the PR.

Design principles:

- Deterministic prompts and schema'd outputs to enable automated parsing and UI display.
- Idempotent operations: re-running jobs should be safe and merge results.
- Safety-first: do not auto-apply changes without human approval.

Privacy & data handling:

- Avoid sending secrets or sensitive tokens to third-party LLMs. Filter content before transmission.
- Respect repository privacy and organization policies.

---

## Observability & monitoring

- Tracing: OpenTelemetry-compatible traces are emitted from API and worker services.
- Metrics: instrumented counters and histograms for job throughput, latency, and error rates.
- Logs: structured JSON logs emitted to stdout for collection by your logging pipeline.
- Error reporting: optional Sentry integration via `SENTRY_DSN`.

Recommendations for production:

- Centralize traces and logs (e.g., OpenTelemetry collector + vendor backend).
- Alert on sustained error-rate increases, queue backlogs, and processing latency regressions.

---

## Authentication & RBAC

- Authentication is handled by the API (OAuth / GitHub App or SSO integrations are supported via configuration).
- Sessions are issued to the frontend and protected with `NEXTAUTH_SECRET`.
- Role-based access controls (RBAC):
  - `admin`: full access to org and billing
  - `maintainer`: manage repos and review queues
  - `viewer`: read-only dashboard and reports

Implementation notes:

- RBAC is enforced server-side in API endpoints and used to conditionally render UI actions in the frontend.
- Map external identity providers (GitHub org membership, SSO groups) to internal roles during onboarding.

---

## CI / CD overview

- CI runs linting, typecheck, unit tests, and Playwright E2E in PR pipelines.
- Build artifacts are produced per-app and can be published to your container registry or deployed to a cloud service.

Suggested pipeline stages:

1. Install & caching (`pnpm install`, workspace cache)
2. Lint & typecheck (`pnpm -w run lint`, `pnpm -w run typecheck`)
3. Unit tests & build (`pnpm -w test`, `pnpm -w build`)
4. E2E (optional gated step against staging)
5. Build & push images (if using containers)
6. Deploy to staging, run smoke tests, then promote to production

---

## Deployment

Minimal production deployment guidance:

- Containerize apps (Docker) and deploy using a managed platform or orchestrator (e.g., Kubernetes, ECS, or platform-as-a-service).
- Use managed PostgreSQL and Redis for resiliency and backups.
- Centralize secrets in a vault; enable rotation for API keys and GitHub App credentials.

Example (Kubernetes) outline:

1. Build container images for `apps/api`, `apps/web`, and `apps/worker`.
2. Apply K8s manifests or Helm chart for each service, including `Deployment`, `Service`, and `HorizontalPodAutoscaler`.
3. Use a managed database and configure `DATABASE_URL`.
4. Configure ingress and TLS for `apps/web`.

For Vercel-specific deployment guidance for the `apps/web` frontend, see: [docs/deployment/vercel.md](docs/deployment/vercel.md)

---

## Scalability considerations

- Workers are horizontally scalable — ensure job queues (Redis, SQS, etc.) are provisioned to handle bursts.
- Database: use read replicas and connection pooling for high concurrency.
- Caching: use Redis for hot data (review summaries, recent PR results) to reduce DB load.
- Rate-limits: protect third-party APIs (GitHub, LLM providers) with retries and backoff.

---

## Accessibility & performance

- Frontend is built with accessibility in mind (semantic HTML, keyboard navigation, focus rings).
- Use Lighthouse and axe-core audits during CI to detect regressions.
- Images and assets: use optimized formats and modern caching headers.
- Motion: provide reduced-motion preferences and maintain consistent, subtle UI transitions.

---

## Roadmap (future work)

Short-term priorities:

- Enterprise SSO provisioning and SCIM support
- Advanced policy authoring UI for org-level rules
- Faster incremental AI analysis (delta-only processing)

Medium-term:

- Self-hosted model runner (on-prem inference)
- Audit logs and compliance-focused reporting

Long-term:

- Multi-LLM provider abstraction and cost-aware routing
- Deeper IDE integrations (VS Code extension)

---

## Recruiter-focused highlights

- Product value: demonstrates an end-to-end SaaS product that combines modern frontend UX, backend orchestration, and ML/AI integrations.
- Engineering signals: monorepo architecture, workspace-scale typechecking, E2E automation with Playwright, and robust observability.
- Team impact: features focused on reducing review friction, improving engineering velocity, and surfacing actionable insights.

Include these in candidate conversations and demos to showcase system design, ownership, and product-market fit thinking.

---

## Contributing

We welcome contributions. Please follow these steps:

1. Fork the repo and create a branch for your change.
2. Run `pnpm install` and validate with `pnpm -w run typecheck` and `pnpm -w run test`.
3. Open a pull request with a clear description and testing steps.

Code of Conduct: Be respectful and collaborative. Follow conventional commit messages where appropriate.

---

## License

This repository is licensed under the MIT License. See the `LICENSE` file for details.

---

If you'd like, I can also:

- Add a `docs/screenshots` folder with template images
- Generate a short `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` to pair with this README

Would you like me to create those as follow-ups?
