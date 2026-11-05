# Builds the React SPA and serves it with nginx as a non-root user.
# Build context: FRONTEND/app. Keep Node in sync with .nvmrc (CI reads it).
FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ENV VITE_API_MODE=live \
    VITE_REALTIME_ENABLED=true
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28.0-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
