# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-04-28

## Current Phase: Phase 3 — Student Registration Module

---

## ✅ Completed

### Phase 1 — Infrastructure & Scaffold
- [x] Next.js 16 + TypeScript + Tailwind + App Router + `src/` dir
- [x] Full folder structure per Engineering spec §7
- [x] `docker-compose.yml` — PostgreSQL 16 + pgAdmin
- [x] `.env.local` / `.env.example` per Engineering spec §8.1
- [x] `drizzle.config.ts` with dotenv loading
- [x] All locked stack dependencies installed

### Phase 1 — Database
- [x] Full 20-table schema in `lib/db/schema.ts` (all spec §11 entities + OR booklet model)
- [x] DB client singleton in `lib/db/index.ts`
- [x] Migration generated and applied (`drizzle/0000_...sql`)

### Phase 1 — Core Library
- [x] Role constants + labels — `lib/constants/roles.ts`
- [x] Environment fail-fast validation — `lib/utils/env.ts`
- [x] Full RBAC permission map (7 roles) — `lib/rbac/permissions.ts`
- [x] Structured JSON logger — `lib/observability/logger.ts`

### Phase 2 — Authentication & Session
- [x] `lib/auth/session.ts` — JWT-signed sessions (jose), DB-backed, httpOnly cookie, sliding renewal, server-side revocation
- [x] `lib/validators/auth.ts` — Zod login schema
- [x] `lib/security/rateLimit.ts` — In-memory sliding window rate limiter
- [x] `actions/auth.ts` — Login + logout server actions (constant-time auth, audit logging, role redirect)
- [x] `proxy.ts` — Route proxy: unauthenticated redirect, role-based guards, staff/portal separation
- [x] `components/auth/LoginForm.tsx` — Client form with `useActionState`, pending state, error display
- [x] `scripts/seed.ts` — Admin seed script (`npm run db:seed`)
- [x] `tsconfig.json` + `next.config.ts` — Path alias fix for root-level `lib/`, `actions/`, `components/`
- [x] Admin seeded: username `admin`, password `Admin@2026!` (force-password-change=true)
- [x] Admin dashboard layout with sidebar navigation
- [x] Admin dashboard page shell
- [x] **End-to-end login flow verified**: login → redirect to `/admin/dashboard` ✓

---

## 🔄 In Progress

- [ ] Phase 3 — Student Registration Module

---

## ⏳ Not Started

See `PROJECT_ROADMAP.md` Phases 3–12.

---

## 🔄 In Progress

- [ ] First DB migration generation and apply (`npm run db:generate && npm run db:migrate`)
- [ ] Auth.js session handler (login action, session validation)
- [ ] Route middleware (role-based redirect after login)

---

## ⏳ Not Started (Phase 2+)

See `PROJECT_ROADMAP.md` for full phase breakdown.
