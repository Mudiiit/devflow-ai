# syntax=docker/dockerfile:1.7

FROM node:22.15.0-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.5.4 prune --scope=web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG APP_NAME=web
ENV NODE_ENV=production
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=${APP_NAME}

FROM node:22.15.0-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
