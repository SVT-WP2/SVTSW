# svt-db-agent-next: the NestJS re-implementation of the SVT DB Agent.
#
# Build context is the Nx workspace (UI/), not this folder: the app builds from
# the workspace libs (libs/epic-api-types/*, libs/svt-db/*) and the root
# package-lock.json.
#
#   cd UI && docker build -f apps/svt-db-agent-next/Dockerfile -t svt-db-agent-next .
#
# Configuration comes from the SVT_DB_AGENT_* environment variables only (the
# committed .env.* files are excluded by .dockerignore); see
# Environment/Dev/docker-compose-svtsw-dev.yml for the variables the container gets.

# ---- Stage 1: build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Disable the Nx daemon in one-shot builds (no benefit, and a known source of
# `NX [object Object]` errors when it times out).
ENV NX_DAEMON=false

# Production bundle + a package.json/package-lock.json holding only the
# runtime dependencies (NxAppWebpackPlugin generatePackageJson).
RUN npx nx build svt-db-agent-next

# ---- Stage 2: runtime ----
FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist/apps/svt-db-agent-next ./
# The lockfile Nx generates next to the bundle is pruned from the workspace lock
# and misses some nested packages (e.g. content-type), so `npm ci` refuses it;
# `npm install` reconciles it from the pinned direct versions instead.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

ENV NODE_ENV=production
ENV SVT_DB_AGENT_HTTP_PORT=7676
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

EXPOSE ${SVT_DB_AGENT_HTTP_PORT}

# GET /health (@nestjs/terminus). Phase 2 adds the database indicator, phase 4
# the Kafka consumer; the probe stays the same. busybox wget fails on HTTP 503.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD wget -q -O /dev/null "http://localhost:${SVT_DB_AGENT_HTTP_PORT}/health" || exit 1

USER node

# node is PID 1 and receives SIGTERM directly (enableShutdownHooks).
CMD ["node", "main.js"]
