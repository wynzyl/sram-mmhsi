# Plan: Validate Security Audit Report Against Deployment Architecture + add Scalability Review

## Context

The auth/session/RBAC audit (`docs/SECURITY/SECURITY-AUDIT-REPORT.md`) already exists. The user now
asks: **is that report valid for their actual deployment** — WAN access, Ubuntu Server, local
PostgreSQL, Docker container behind a VPN, **no internet transactions today**, but it must be
**scalable to online payments + online registrations**.

**Verification verdict (to state up front in the report):** the report's code-level findings
(A-1–A-7, X-1) are **deployment-independent and remain valid**, and their severities are
appropriate-to-slightly-conservative for the *current* VPN-gated, no-internet posture (residual risk
is genuinely **Low** today). The gap is that the report never addressed **infrastructure** or the
**"scale to public" delta** — which is exactly the question. So the deliverable is to **extend the
existing report** with a Deployment & Scalability section rather than rewrite it.

Both clarifying answers were "undecided": no confirmed reverse proxy, scale topology TBD. Therefore
document **both** edge cases with a checklist, and plan **horizontal scaling as the safe default**,
flagging what is deferrable if they stay single-instance.

This remains **report-only** — no source/config/Docker changes; recommendations + snippets live in
the doc.

## Verified infra/code facts (evidence)
- **Login rate-limit keys on raw `X-Forwarded-For` first hop, fallback `"unknown"`**
  (`src/features/auth/auth.actions.ts:51-53`). Spoofable if app is directly reachable; shared egress
  IP (VPN/NAT) collapses all users into one bucket.
- **In-memory rate limiter** (`src/lib/security/rateLimit.ts:11-18`) — explicitly single-process;
  resets on restart, does not span replicas.
- **`Dockerfile`** serves plain HTTP on `:3000` via `npm run start`, **no TLS / reverse proxy in
  repo**; runs as **non-root** (good). Cookie is `secure: NODE_ENV==="production"`
  (`session.ts:88,159`) → over a VPN the browser still speaks HTTP, so the secure cookie is dropped
  unless something terminates TLS at the edge.
- **Sessions are DB-backed** (`sessions` table) → already horizontally scalable (good).
- **Local Postgres in Docker** → amplifies **X-1** (the committed `srams_backup.sql` PII dump).
- Existing `docs/SECURITY.md` already lists in-memory-rate-limit and no-IP-validation as known
  limitations — align with it, don't contradict.

## Deliverable: extend `docs/SECURITY/SECURITY-AUDIT-REPORT.md`

1. **Edit the header/exec summary** — add one line: assessment is made against the documented
   topology (WAN + Ubuntu + local Postgres + Docker/VPN, no internet txns), and a one-paragraph
   **verification verdict** (code findings hold; infra delta added below).
2. **Add new section "§9 Deployment Architecture & Scalability Review"** with a findings table
   (D-series) and these items, each with evidence + recommendation/snippet:
   - **D-1 — Spoofable / shared-IP login rate limiting.** Severity depends on edge: **High** if no
     trusted proxy, **Low (verify config)** if a trusted proxy overwrites XFF. Fix: read client IP
     from a trusted hop only (fixed trusted-proxy count, not raw first token); add **per-account**
     throttling + exponential backoff/lockout so spoofing can't bypass and shared IP can't lock
     everyone out. Don't fall back to a single `"unknown"` bucket.
   - **D-2 — `secure` cookie requires a TLS edge the container/VPN don't provide.** Operational; if
     misconfigured, **auth silently breaks** (prod) or **cookies sent cleartext** (if `secure`
     disabled). Provide a **both-cases checklist**: (a) TLS-terminating reverse proxy in front
     (recommended) → keep `secure`, add HSTS + CSP at the proxy; (b) plain HTTP over VPN → you cannot
     safely use `secure` cookies; terminate TLS instead. Note VPN ≠ HTTPS for cookie semantics.
   - **D-3 — In-memory rate limiter is a horizontal-scaling blocker.** When multi-instance: move to
     Redis/Postgres-backed limiter. Note sessions are already DB-backed (scale-ready). Deferrable if
     staying single-instance — call that out.
   - **D-4 — Local Postgres / Docker hardening.** Don't publish `5432` to host/WAN (keep on the
     Docker network); enable DB TLS if cross-host; strong creds; **don't bake `.env` into the
     image**; pin base image by digest. Ties remediation of **X-1** (purge dump + rotate creds) to
     the local-DB reality.
   - **D-5 — "Going public" delta for online payments/registration.** When portal/registration
     becomes internet-facing: A-4 (`SameSite=Strict`) and A-1/A-2 escalate from hardening to
     important; add edge WAF/bot/rate protection + CAPTCHA on public registration; for Stripe —
     **verify webhook signatures**, use idempotency keys, keep card data in **Stripe-hosted
     Checkout/Elements** to minimize PCI scope, and **reconcile online payments with the mandatory
     OR-booklet workflow** (business rule: every payment consumes an OR number).
3. **Add "§10 Architecture posture summary"** — current (VPN-gated, no txns) = **Low** residual
   risk; pre-public-launch gate = fix X-1, A-1, D-1, D-2, then D-3/D-5. Short staged checklist
   (Now / Before horizontal scale / Before public exposure).

## Out of scope
No code, Docker, migration, or config edits. All items are recommendations/snippets in the report.
A follow-up pass can implement (e.g., trusted-IP extraction + Redis limiter) on request.

## Verification
- Doc-only. After editing, confirm new `file:line` citations resolve (`auth.actions.ts:51-53`,
  `rateLimit.ts:11-18`, `Dockerfile`, `session.ts:88,159`) and that §9/§10 don't contradict the
  existing A-series severities or `docs/SECURITY.md`.
