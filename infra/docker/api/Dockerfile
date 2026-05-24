# syntax=docker/dockerfile:1.7

FROM node:22.15.0-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
RUN apk add --no-cache curl
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.5.4 prune --scope=api --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG APP_NAME=api
ENV NODE_ENV=production
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=${APP_NAME}

FROM node:22.15.0-alpine AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=builder /app ./
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
	CMD curl -f http://localhost:4000/health/ready || exit 1
CMD ["node", "apps/api/dist/main.js"]
