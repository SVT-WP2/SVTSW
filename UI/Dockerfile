# ---- Stage 1: Build ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --force

COPY . .

# Disable the Nx daemon in CI/Docker builds (no benefit in one-shot builds,
# and a known source of `NX [object Object]` errors when it times out).
ENV NX_DAEMON=false


# Build Angular frontend (production)
RUN npx nx build epic-measure-ui --configuration=production

# Build NestJS backend (production)
RUN npx nx build epic-measure-api

# ---- Stage 2: Production ----
FROM node:20-alpine

RUN apk add --no-cache nginx gettext curl

WORKDIR /app

# Copy built API + its generated package.json
COPY --from=build /app/dist/apps/epic-measure-api ./api/
RUN cd /app/api && npm install --omit=dev --force 2>/dev/null || true

# Copy built Angular frontend
COPY --from=build /app/dist/apps/epic-measure-ui/browser /usr/share/nginx/html

# Copy nginx template and entrypoint
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default environment variables
ENV SVT_UI_PORT=8080
ENV SVT_UI_API_PORT=9393
ENV KAFKA_BROKER=localhost:9092
ENV NODE_ENV=production
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

EXPOSE ${SVT_UI_PORT}

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=30s \
    CMD curl -f http://localhost:${SVT_UI_API_PORT}/api/health/version || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]

