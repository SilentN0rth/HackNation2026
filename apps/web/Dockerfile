FROM node:24.22.3-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24.22.3-alpine3.24 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* są wkompilowane w bundle podczas buildu
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_USE_MOCKS=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_USE_MOCKS=$NEXT_PUBLIC_USE_MOCKS NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build

FROM node:24.22.3-alpine3.24
WORKDIR /app
# Baza SQLite i wgrane pliki żyją na wolumenie /app/data; sekret Payloada z Docker secrets.
# Migracje uruchamia Payload przy starcie (prodMigrations), seed demo – gdy PAYLOAD_SEED=true.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/payload.db MEDIA_DIR=/app/data/media \
    PAYLOAD_SECRET_FILE=/run/secrets/payload_secret
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# /app/data to wolumen: w compose `web-data`, na Railway wolumen usługi (Railway nie przyjmuje instrukcji VOLUME).
RUN mkdir -p /app/data/media && chown -R node:node /app/data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/" >/dev/null || exit 1
CMD ["node", "server.js"]
