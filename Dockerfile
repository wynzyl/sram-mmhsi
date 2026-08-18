
# --- Dev stage (hot reload via `next dev`) ---
FROM node:24-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
# Slow-link hardening: @next/swc-linux-x64-musl is ~43MB and takes >300s on a
# ~140KB/s connection, which exceeds npm's default fetch-timeout (300s) — npm
# aborts mid-tarball and fails with ECONNRESET every run. Raise the per-request
# timeout and keep npm's _cacache in a BuildKit cache mount so an interrupted
# install resumes from what it already fetched (cache mounts survive --no-cache).
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-timeout=1800000 --fetch-retries=5 --fetch-retry-maxtimeout=300000 \
           --maxsockets=3 --prefer-offline
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
# Also install vips-dev for sharp native bindings compilation.
RUN apk add --no-cache postgresql su-exec vips-dev

COPY package*.json ./
# Same slow-link hardening as the dev stage — see the note there.
RUN --mount=type=cache,target=/root/.npm \
    npm install --production=false --fetch-timeout=1800000 --fetch-retries=5 \
                --fetch-retry-maxtimeout=300000 --maxsockets=3 --prefer-offline
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
# Install dependencies for sharp native bindings and privilege drop:
# - libc6-compat: glibc compatibility layer for Alpine
# - vips-dev: libvips for sharp image processing
# - su-exec: lightweight privilege drop (used by entrypoint to fix volume permissions)
RUN apk add --no-cache libc6-compat vips-dev su-exec
# Create non-root user and group
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# ============================================================================
# STANDALONE OUTPUT: Next.js traces only the files needed for production,
# drastically reducing image size (no full node_modules).
# ============================================================================

# Copy standalone server (self-contained with traced node_modules)
# .next must be writable by the runtime user: Next writes refreshed "use cache"
# / ISR prerenders back into .next/server at request time (EACCES otherwise).
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./

# Copy static assets (not included in standalone by default - meant for CDN)
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Copy public folder (not included in standalone by default - meant for CDN)
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# ============================================================================
# RUNTIME SCRIPTS: Drizzle migrations and maintenance scripts need separate
# node_modules and source files since they run outside the Next.js server.
# ============================================================================

# Drizzle migrations + seed/maintenance scripts must exist at runtime
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
# tsconfig.json is required at runtime: tsx (db:migrate / db:seed) resolves the
# `@/*` path aliases from it. Without it, any script importing schema.ts via `@/`
# fails with "Cannot find module '@/lib/...'".
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# package.json needed for npm run db:migrate etc.
COPY --from=builder /app/package*.json ./

# Copy src directory for runtime scripts that import from @/lib/*
COPY --from=builder /app/src ./src

# Copy node_modules/.bin for CLI tools (tsx, drizzle-kit)
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

# Copy dependencies for runtime migrations (tsx, drizzle, dotenv, etc.)
# These aren't in standalone output because they're devDependencies or script-only
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/dotenv-expand ./node_modules/dotenv-expand

# Add node_modules/.bin to PATH for CLI tools
ENV PATH="/app/node_modules/.bin:$PATH"

# Ensure upload directory exists (permissions will be fixed at runtime by entrypoint
# since Docker volume mounts override build-time ownership)
RUN mkdir -p /app/public/uploads/students

# Copy entrypoint script that fixes volume permissions and drops to nextjs user
# Use sed to convert Windows CRLF to Unix LF (Windows git may add CR)
COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Bind all interfaces. Docker injects HOSTNAME=<container id> and Next's
# standalone server.js honours it (`process.env.HOSTNAME || '0.0.0.0'`), so
# without this the server listens on ONE network IP only: the localhost
# HEALTHCHECK below always gets ECONNREFUSED, and with the app on both
# srams-network and proxy-network the other network can't reach it at all.
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Expose the default Next.js port
EXPOSE 3000

# Entrypoint fixes volume permissions then drops to nextjs user
ENTRYPOINT ["docker-entrypoint.sh"]

# Healthcheck via /api/readiness: verifies the DB is reachable (SELECT 1) and
# doubles as a pool keepalive — the 30s probe keeps a warm connection in the
# shared postgres pool so the first user transaction never pays a TCP connect.
# Probe 127.0.0.1, not `localhost`: busybox wget resolves localhost to [::1]
# first and never falls back, while the server binds IPv4 (0.0.0.0) — the
# container would sit permanently unhealthy on ECONNREFUSED.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/readiness || exit 1

# Run standalone server directly with node (no npm overhead)
# PORT and HOSTNAME can be set via environment variables
CMD ["node", "server.js"]