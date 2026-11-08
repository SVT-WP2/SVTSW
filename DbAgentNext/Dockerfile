# svt-db-agent-next: the NestJS re-implementation of the SVT DB Agent.
#
# Build context is the repository root, not this folder: the app compiles
# ../Shared/svt-ts-types through the aliases of its tsconfig.json.
# Dockerfile.dockerignore next to this file limits the context to DbAgentNext/
# (without tests, docs and .env files) and Shared/.
#
#   docker build -f DbAgentNext/Dockerfile -t svt-db-agent-next .
#
# Configuration comes from the SVT_DB_AGENT_* environment variables only (the
# committed .env.* files are not in the build context); see
# Environment/Dev/docker-compose-svtsw-dev.yml for the variables the container gets.

# ---- Stage 1: build ----
FROM node:22-alpine AS build

WORKDIR /app/DbAgentNext

COPY DbAgentNext/package.json DbAgentNext/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY DbAgentNext/ ./
COPY Shared/ ../Shared/

# Production bundle (Nest CLI, webpack): the app and ../Shared/svt-ts-types in
# dist/main.js, every npm package left external.
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-alpine

WORKDIR /app

# The runtime packages, from the app's own lockfile.
COPY DbAgentNext/package.json DbAgentNext/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/DbAgentNext/dist ./

ENV NODE_ENV=production
ENV SVT_DB_AGENT_HTTP_PORT=7676
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

EXPOSE ${SVT_DB_AGENT_HTTP_PORT}

# GET /health (@nestjs/terminus): database and Kafka. busybox wget fails on HTTP 503.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD wget -q -O /dev/null "http://localhost:${SVT_DB_AGENT_HTTP_PORT}/health" || exit 1

USER node

# node is PID 1 and receives SIGTERM directly (enableShutdownHooks).
CMD ["node", "main.js"]
