
# --- Dev stage (hot reload via `next dev`) ---
FROM node:24-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Builder stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# Ephemeral PostgreSQL — used ONLY during `next build`. Next's `cacheComponents`
# (next.config.ts) prerenders `"use cache"` DB-backed pages (e.g. the dashboards)
# at build time, so the build needs a reachable, migrated database. This Postgres
# lives entirely in the throwaway builder stage and never ships in the runner image.
RUN apk add --no-cache postgresql su-exec

COPY package*.json ./
RUN npm install --production=false
COPY . .

ENV NEXT_PUBLIC_SKIP_ENV_VALIDATION="true"
# Connection string for the ephemeral build-time Postgres started below.
# Consumed by scripts/migrate.ts (npm run db:migrate) and by next build's prerender.
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/srams_build"

# Start Postgres → apply Drizzle migrations → build → stop, all in one layer so the
# server process never lingers between image layers. `--auth=trust` means the
# password in DATABASE_URL is ignored (build-only, never networked).
RUN set -eux; \
    export PGDATA=/tmp/pgbuild; \
    install -d -o postgres -g postgres "$PGDATA"; \
    su-exec postgres initdb -U postgres --auth=trust -D "$PGDATA" >/dev/null; \
    su-exec postgres pg_ctl -D "$PGDATA" \
      -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp -p 5432" \
      -w -l /tmp/pg.log start; \
    su-exec postgres createdb -h 127.0.0.1 -U postgres srams_build; \
    npm run db:migrate; \
    npm run build; \
    su-exec postgres pg_ctl -D "$PGDATA" -m immediate stop

# --- Runtime stage ---
FROM node:24-alpine AS runner
WORKDIR /app
# Create non-root user and group
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# Copy only production dependencies and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# .next must be writable by the runtime user: Next writes refreshed "use cache"
# / ISR prerenders back into .next/server at request time (EACCES otherwise).
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
# Next.js 16 proxy (formerly middleware.ts) - handles auth redirects and session management
COPY --from=builder /app/proxy.ts ./proxy.ts
COPY --from=builder /app/src ./src
# Drizzle migrations + seed/maintenance scripts must exist at runtime
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
# tsconfig.json is required at runtime: tsx (db:migrate / db:seed) resolves the
# `@/*` path aliases from it. Without it, any script importing schema.ts via `@/`
# fails with "Cannot find module '@/lib/...'".
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose the default Next.js port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Healthcheck via /api/readiness: verifies the DB is reachable (SELECT 1) and
# doubles as a pool keepalive — the 30s probe keeps a warm connection in the
# shared postgres pool so the first user transaction never pays a TCP connect.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/readiness || exit 1

# Run the production server
CMD ["npm", "run", "start"]