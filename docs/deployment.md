# Deployment

DevFlow AI ships with a production Docker Compose stack, a development override, and GitHub Actions workflows for CI and image publishing.

## Local development

Use the development override to run the apps with live source mounts:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The dev stack starts Postgres, Redis, API, worker, and web with the same shared environment variables used in the workspace.

## Production

The base `docker-compose.yml` is the production-oriented runtime definition. It builds the optimized runner images from:

- [infra/docker/api/Dockerfile](../infra/docker/api/Dockerfile)
- [infra/docker/web/Dockerfile](../infra/docker/web/Dockerfile)
- [infra/docker/worker/Dockerfile](../infra/docker/worker/Dockerfile)

The production compose stack exposes:

- API on port 4000
- Web on port 3000
- Postgres on port 5432
- Redis on port 6379

## Scripts

- [scripts/dev.ps1](../scripts/dev.ps1) launches the development stack.
- [scripts/deploy.ps1](../scripts/deploy.ps1) launches the production compose stack.

## CI/CD

- [.github/workflows/ci.yml](../.github/workflows/ci.yml) installs dependencies and runs `pnpm build`.
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) builds and publishes Docker images for `api`, `web`, and `worker` to GHCR.

## Runtime checks

- `/health/live` reports liveness.
- `/health/ready` checks Postgres and Redis readiness.
- `/metrics` exposes the in-memory observability snapshot, including queue metrics in the worker.
