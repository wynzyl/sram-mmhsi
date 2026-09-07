# Memory

## Current Status (2026-09-07)

**Production-ready:** Auth, students, registrations, enrollments, assessments, payments/OR, invoices, grades, student archival, document requests.

**Pending:** Portal detail pages (`/portal/assessments`, `/portal/payments`, `/portal/grades`), dedicated registration intake/review actions.

## Key Decisions

- **2026-09-07:** Prefer Suspense pattern over `instant = false` for new pages (sync shell + async content)
- **2026-09-05:** Pages with session access use `export const instant = false` as fallback only
- **2026-06-29:** Use `invalidateTag()` (non-blocking) instead of `forceUpdateTag()` in server actions
- **2026-06-04:** Multiple OR booklets may be active simultaneously (owner-confirmed)
- **2026-05-28:** TanStack Form for complex wizard/field-array forms only; simple forms use native `useActionState`

## Established Patterns

- **Instant Navigation:** Sync page component + `<Suspense>` wrapping async content component
- **Forms:** `useActionState` + `useFormToast` for success/error notifications
- **Actions:** `ConfirmActionButton` for delete/void/lock operations
- **Tables:** TanStack Table + TanStack Query for client-side data
- **Reports:** `@react-pdf/renderer` for PDF, `exceljs` for XLSX
- **Dates:** Always use `formatDate`/`formatDateTime` (Asia/Manila timezone)
- **Cache:** `revalidatePath()` + `invalidateTag()` for `"use cache"` queries

## Debugging Notes

- **Payment freeze:** Caused by blocking `forceUpdateTag()` in Docker — use `invalidateTag()` instead
- **Hydration mismatch:** Hand-rolled `toLocaleDateString()` without timezone — use `src/lib/utils/date.ts`
- **Photo 400 errors:** Next.js Image Optimization fails for runtime uploads — add `unoptimized` prop
- **Login redirect loop:** `SESSION_COOKIE_SECURE=true` over HTTP — set `false` for LAN without TLS
- **Migration ignored:** Manually created SQL without journal entry — always use `npm run db:generate`
- **Turbopack errors:** "negative time stamp" is harmless — ignore

## Preferences

- Parallel `Promise.all()` for independent DB queries
- Soft delete only (`deletedAt`/`deletedBy`)
- Feature-based folder structure (`src/features/*`)
- snake_case for migration names
- Reusable components over one-off implementations
