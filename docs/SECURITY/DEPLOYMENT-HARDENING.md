# SRAMS Deployment Hardening Guide

This document describes security best practices for deploying SRAMS in production environments.

## Table of Contents

1. [TLS Configuration](#tls-configuration)
2. [Docker Security](#docker-security)
3. [Database Hardening](#database-hardening)
4. [Environment Variables](#environment-variables)
5. [Reverse Proxy Configuration](#reverse-proxy-configuration)
6. [Monitoring & Alerting](#monitoring--alerting)

---

## TLS Configuration

### Requirements

SRAMS requires HTTPS in production for:
- Secure cookie transmission (`secure: true`)
- Protection against man-in-the-middle attacks
- Compliance with modern web security standards

### Architecture

```
┌──────────┐      HTTPS       ┌─────────────────┐      HTTP       ┌─────────────┐
│  Client  │ ───────────────> │  Reverse Proxy  │ ─────────────> │  SRAMS App  │
└──────────┘                  │  (TLS Termination)│               └─────────────┘
                              └─────────────────┘
                                      │
                                      ▼
                              ┌─────────────────┐
                              │   PostgreSQL    │
                              │  (Internal Net) │
                              └─────────────────┘
```

### Certificate Options

1. **Let's Encrypt (Recommended for production)**
   - Free, automated certificates
   - Use certbot or acme.sh for renewal

2. **Self-signed (Development/VPN only)**
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout server.key -out server.crt
   ```

---

## Docker Security

### Hardened docker-compose.yml

```yaml
version: "3.9"

services:
  # PostgreSQL - Internal network only
  db:
    # Pin image by SHA256 digest for reproducibility
    image: postgres:16@sha256:abc123...
    container_name: srams-db
    restart: unless-stopped

    # NO PORTS EXPOSED - internal network only
    # ports:
    #   - "5432:5432"  # NEVER expose in production

    networks:
      - internal

    environment:
      POSTGRES_DB: srams_db
      POSTGRES_USER: srams
      # Use Docker secrets instead of env vars
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

    secrets:
      - db_password

    volumes:
      - postgres_data:/var/lib/postgresql/data
      # Optional: Custom pg_hba.conf for SSL enforcement
      # - ./config/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U srams -d srams_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # SRAMS Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      # Don't include .env in build context
      args:
        - NODE_ENV=production
    container_name: srams-app
    restart: unless-stopped

    depends_on:
      db:
        condition: service_healthy

    networks:
      - internal
      - external

    # Only expose to reverse proxy, not host
    expose:
      - "3000"

    environment:
      NODE_ENV: production
      # Read secrets from files
      DATABASE_URL_FILE: /run/secrets/database_url
      AUTH_SECRET_FILE: /run/secrets/auth_secret

    secrets:
      - database_url
      - auth_secret
      - cron_secret

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine@sha256:def456...
    container_name: srams-nginx
    restart: unless-stopped

    ports:
      - "443:443"
      - "80:80"  # Redirect to HTTPS

    networks:
      - external

    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx

    depends_on:
      - app

networks:
  internal:
    internal: true  # No external access
    driver: bridge
  external:
    driver: bridge

volumes:
  postgres_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
  database_url:
    file: ./secrets/database_url.txt
  auth_secret:
    file: ./secrets/auth_secret.txt
  cron_secret:
    file: ./secrets/cron_secret.txt
```

### Secrets Management

Create secrets directory (git-ignored):

```bash
mkdir -p secrets
chmod 700 secrets

# Generate secrets
openssl rand -base64 32 > secrets/auth_secret.txt
openssl rand -base64 24 > secrets/cron_secret.txt
openssl rand -base64 16 | tr -d '\n' > secrets/db_password.txt

# Create DATABASE_URL
DB_PASS=$(cat secrets/db_password.txt)
echo "postgresql://srams:${DB_PASS}@db:5432/srams_db" > secrets/database_url.txt

# Secure permissions
chmod 600 secrets/*.txt
```

### Application Code for Secrets

Update your application to read from files:

```typescript
// src/lib/config/secrets.ts
import fs from "fs";

function readSecret(envVar: string): string {
  // Check for _FILE suffix first (Docker secrets pattern)
  const fileEnv = process.env[`${envVar}_FILE`];
  if (fileEnv && fs.existsSync(fileEnv)) {
    return fs.readFileSync(fileEnv, "utf8").trim();
  }
  // Fall back to direct env var
  return process.env[envVar] ?? "";
}

export const config = {
  databaseUrl: readSecret("DATABASE_URL"),
  authSecret: readSecret("AUTH_SECRET"),
  cronSecret: readSecret("CRON_SECRET"),
};
```

---

## Database Hardening

### PostgreSQL Configuration

1. **Network Binding**
   - Bind to Docker internal network only
   - Never expose port 5432 to host

2. **SSL Connections**
   ```sql
   -- In postgresql.conf
   ssl = on
   ssl_cert_file = '/etc/ssl/certs/server.crt'
   ssl_key_file = '/etc/ssl/private/server.key'
   ```

3. **Authentication**
   ```
   # pg_hba.conf - require SSL for all connections
   hostssl all all 0.0.0.0/0 scram-sha-256
   ```

4. **User Privileges**
   ```sql
   -- Create application user with minimal privileges
   CREATE USER srams_app WITH PASSWORD 'xxx';
   GRANT CONNECT ON DATABASE srams_db TO srams_app;
   GRANT USAGE ON SCHEMA public TO srams_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO srams_app;
   GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO srams_app;

   -- Revoke dangerous privileges
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   ```

### Backup Security

```bash
# Encrypt backups at rest
pg_dump srams_db | gpg --symmetric --cipher-algo AES256 > backup.sql.gpg

# Store in secure location with restricted access
chmod 600 backup.sql.gpg
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | JWT signing key (min 32 bytes) | `openssl rand -base64 32` |
| `CRON_SECRET` | Cron endpoint auth | `openssl rand -base64 24` |
| `NODE_ENV` | Environment mode | `production` |
| `TRUSTED_PROXY_COUNT` | Number of reverse proxies | `1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis for distributed rate limiting | (none - uses in-memory) |

### Security Rules

1. **Never commit secrets to git**
2. **Use Docker secrets or secret management service**
3. **Rotate secrets periodically**
4. **Use different secrets per environment**

---

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/nginx.conf

events {
    worker_connections 1024;
}

http {
    # Rate limiting at edge
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # TLS configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Proxy to SRAMS app
        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;

            # Required headers for proper IP extraction
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Host $host;

            # WebSocket support (if needed)
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Rate limit login endpoint
        location /login {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://app:3000;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Host $host;
        }

        # Rate limit API endpoints
        location /api/ {
            limit_req zone=api burst=50 nodelay;
            proxy_pass http://app:3000;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Host $host;
        }
    }
}
```

### Caddy Configuration (Alternative)

```caddyfile
your-domain.com {
    # Automatic HTTPS with Let's Encrypt
    tls {
        protocols tls1.2 tls1.3
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }

    # Rate limiting
    rate_limit {
        zone login {
            key {remote_host}
            events 5
            window 1s
        }
    }

    # Proxy to app
    reverse_proxy app:3000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## Monitoring & Alerting

### Health Check Endpoint

Implement `/api/health` for container orchestration:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);

    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { status: "unhealthy", error: "Database connection failed" },
      { status: 503 }
    );
  }
}
```

### Log Aggregation

Configure structured logging for security monitoring:

```typescript
// Log security events
logger.warn("[auth] Failed login attempt", {
  username,
  ip: clientIp,
  userAgent: headers.get("user-agent"),
});
```

### Alerts to Configure

1. **Authentication failures:** >10 in 5 minutes
2. **Rate limit triggers:** >100 in 1 hour
3. **Session hijack attempts:** Any User-Agent mismatch
4. **Database connectivity:** Any health check failure
5. **Cron failures:** Session cleanup errors

---

## Pre-Deployment Checklist

- [ ] TLS certificates configured and valid
- [ ] Database not exposed to host network
- [ ] All secrets stored securely (not in .env committed to git)
- [ ] AUTH_SECRET is at least 32 bytes
- [ ] TRUSTED_PROXY_COUNT matches your infrastructure
- [ ] Reverse proxy configured with security headers
- [ ] Health checks enabled for all containers
- [ ] Backup encryption configured
- [ ] Log aggregation set up
- [ ] Alert thresholds configured
