# Plan: Multi-Booklet Assignment per User

## Overview
Change from one-to-one (user → single booklet via `defaultBookletId`) to one-to-many (user → multiple booklets via junction table) relationship. Cashiers will only see their assigned booklets when posting payments.

## Requirements (Confirmed)
- **Primary Booklet**: Keep concept of a "default/primary" booklet for quick selection
- **Visibility**: Cashiers only see their assigned booklets in payment dropdown
- **Data Model**: Junction table `userBookletAssignments` with `isPrimary` flag

## Current State
- `users.defaultBookletId` stores single booklet FK (unique index enforces one-to-one)
- `getAccessibleBookletsForUser()` returns booklets not assigned to others
- Booklet assignment done via dropdown in BookletForm/EditBookletModal

## Tasks

| # | Task | Blocked By |
|---|------|------------|
| 1 | Create `userBookletAssignments` junction table in schema | - |
| 2 | Generate and review migration | 1 |
| 3 | Create data migration script for existing assignments | 2 |
| 4 | Update `payments.queries.ts` for new junction table | 3 |
| 5 | Update `booklets.actions.ts` for multi-assignment | 4 |
| 6 | Create AssignBookletsSchema validation | - |
| 7 | Create multi-select assignment UI component | 6 |
| 8 | Update BookletsTable to show multiple assignees | 7 |
| 9 | Update payment posting to filter by assignments | 4 |
| 10 | Update/add tests for new assignment logic | 9 |
| 11 | Deprecate `users.defaultBookletId` (optional cleanup) | 10 |

## Files to Modify

### Schema & Database
- `src/lib/db/schema.ts` — Add `userBookletAssignments` table + relations
- `drizzle/0037_add_user_booklet_assignments.sql` — Junction table + data migration

### Queries
- `src/features/payments/payments.queries.ts` — Refactor:
  - `getAccessibleBookletsForUser()` → query junction table
  - `getBookletIdsAssignedToOthers()` → query junction table
  - `getCashierDefaultBookletId()` → get primary from junction
  - Add `getBookletAssignmentsForUser()`
  - Add `getUsersAssignedToBooklet()`

### Actions
- `src/features/payments/actions/booklets.actions.ts` — Update:
  - `createBookletAction()` → insert into junction table
  - `updateBookletAction()` → manage junction table entries
  - Add `assignBookletToUserAction()`
  - Add `unassignBookletFromUserAction()`
  - Add `setPrimaryBookletAction()`

### Validation
- `src/features/payments/payments.schema.ts` — Add:
  - `AssignBookletSchema`
  - `SetPrimaryBookletSchema`

### UI Components
- `src/features/finance/components/BookletFormFields.tsx` — Multi-select cashier field
- `src/features/finance/components/EditBookletModal.tsx` — Manage multiple assignees
- `src/features/finance/components/BookletsTable.tsx` — Show multiple assignees
- `src/features/payments/components/PostPaymentForm.tsx` — Filter by assignments

### Page
- `src/app/staff/finance/booklets/page.tsx` — Query assignments via junction

---

## Implementation Details

### 1. Junction Table Schema

```typescript
export const userBookletAssignments = pgTable(
  "user_booklet_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    bookletId: uuid("booklet_id").notNull().references(() => receiptBooklets.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id),
  },
  (t) => ({
    // Prevent duplicate user-booklet pairs
    userBookletUnique: unique("user_booklet_assignment_uidx").on(t.userId, t.bookletId),
    // Index for fast lookups
    userIdx: index("uba_user_idx").on(t.userId),
    bookletIdx: index("uba_booklet_idx").on(t.bookletId),
  })
);

// Relations
export const userBookletAssignmentsRelations = relations(
  userBookletAssignments,
  ({ one }) => ({
    user: one(users, {
      fields: [userBookletAssignments.userId],
      references: [users.id],
    }),
    booklet: one(receiptBooklets, {
      fields: [userBookletAssignments.bookletId],
      references: [receiptBooklets.id],
    }),
  })
);
```

### 2. Migration SQL

```sql
-- Create junction table
CREATE TABLE "user_booklet_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "booklet_id" uuid NOT NULL REFERENCES "receipt_booklets"("id"),
  "is_primary" boolean NOT NULL DEFAULT false,
  "assigned_at" timestamp NOT NULL DEFAULT now(),
  "assigned_by" uuid REFERENCES "users"("id"),
  CONSTRAINT "user_booklet_assignment_uidx" UNIQUE("user_id", "booklet_id")
);

CREATE INDEX "uba_user_idx" ON "user_booklet_assignments"("user_id");
CREATE INDEX "uba_booklet_idx" ON "user_booklet_assignments"("booklet_id");

-- Migrate existing assignments from users.defaultBookletId
INSERT INTO "user_booklet_assignments" ("user_id", "booklet_id", "is_primary", "assigned_at")
SELECT id, default_booklet_id, true, now()
FROM "users"
WHERE default_booklet_id IS NOT NULL;

-- Note: Keep defaultBookletId for now (backward compat), remove in future migration
```

### 3. Updated Query Functions

```typescript
// Get all booklets assigned to a specific user
export async function getBookletsAssignedToUser(userId: string) {
  return db
    .select({
      id: receiptBooklets.id,
      series: receiptBooklets.series,
      prefix: receiptBooklets.prefix,
      nextNumber: receiptBooklets.nextNumber,
      endNumber: receiptBooklets.endNumber,
      isPrimary: userBookletAssignments.isPrimary,
    })
    .from(userBookletAssignments)
    .innerJoin(receiptBooklets, eq(receiptBooklets.id, userBookletAssignments.bookletId))
    .where(
      and(
        eq(userBookletAssignments.userId, userId),
        eq(receiptBooklets.status, "active"),
        eq(receiptBooklets.usageMode, "auto_only"),
        lte(receiptBooklets.nextNumber, receiptBooklets.endNumber)
      )
    )
    .orderBy(desc(userBookletAssignments.isPrimary), asc(receiptBooklets.series));
}

// Get primary booklet for user (replaces getCashierDefaultBookletId)
export async function getUserPrimaryBookletId(userId: string): Promise<string | null> {
  const [result] = await db
    .select({ bookletId: userBookletAssignments.bookletId })
    .from(userBookletAssignments)
    .innerJoin(receiptBooklets, eq(receiptBooklets.id, userBookletAssignments.bookletId))
    .where(
      and(
        eq(userBookletAssignments.userId, userId),
        eq(userBookletAssignments.isPrimary, true),
        eq(receiptBooklets.status, "active")
      )
    )
    .limit(1);
  return result?.bookletId ?? null;
}

// Get users assigned to a specific booklet
export async function getUsersAssignedToBooklet(bookletId: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      email: users.email,
      isPrimary: userBookletAssignments.isPrimary,
    })
    .from(userBookletAssignments)
    .innerJoin(users, eq(users.id, userBookletAssignments.userId))
    .where(
      and(
        eq(userBookletAssignments.bookletId, bookletId),
        isNull(users.deletedAt)
      )
    )
    .orderBy(desc(userBookletAssignments.isPrimary), asc(users.username));
}
```

### 4. Assignment Actions

```typescript
// Assign booklet to user
export async function assignBookletToUserAction(
  _prevState: AssignBookletFormState,
  formData: FormData
): Promise<AssignBookletFormState> {
  // Admin/finance check
  // Validate booklet is active
  // Check if already assigned (update isPrimary if so)
  // Insert into junction table
  // If isPrimary, clear other isPrimary flags for this user
  // Audit log
}

// Unassign booklet from user
export async function unassignBookletFromUserAction(...)

// Set primary booklet for user
export async function setPrimaryBookletAction(...)
```

### 5. UI Changes

#### EditBookletModal — Show/manage multiple assignees:
- List current assignees with "Primary" badge
- Add assignee button (dropdown of eligible cashiers)
- Remove assignee button per row
- Set as primary radio/button per assignee

#### BookletsTable — Multiple assignees column:
- Show comma-separated usernames
- Or show count with tooltip/popover for details

#### PostPaymentForm — Filter booklets:
- Query only assigned booklets (via `getBookletsAssignedToUser`)
- Primary booklet auto-selected in dropdown
- If no assignments, show message "No booklets assigned"

---

## Migration Strategy

1. **Deploy schema change** — Junction table created, data migrated
2. **Deploy code changes** — New queries/actions/UI
3. **Verify functionality** — Test assignment management + payment posting
4. **Future cleanup** — Remove `users.defaultBookletId` column (separate migration)

---

## Verification

1. **Schema**: Junction table exists with proper indexes
2. **Data Migration**: Existing `defaultBookletId` values migrated to junction table with `isPrimary=true`
3. **Assignment Management**:
   - Assign multiple booklets to one user
   - Set primary booklet
   - Remove assignment
4. **Payment Posting**:
   - Cashier sees only their assigned booklets
   - Primary booklet pre-selected
   - Cannot use unassigned booklets
5. **Audit Logging**: All assignment changes logged
6. **Tests**: Run `npm run test -- booklet` — all pass

---

## Critical Files Summary

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `userBookletAssignments` table + relations |
| `drizzle/0037_*.sql` | Migration with data transfer |
| `src/features/payments/payments.queries.ts` | New junction-based queries |
| `src/features/payments/payments.schema.ts` | Assignment validation schemas |
| `src/features/payments/actions/booklets.actions.ts` | Assignment actions |
| `src/features/finance/components/EditBookletModal.tsx` | Multi-assignee management |
| `src/features/finance/components/BookletsTable.tsx` | Show multiple assignees |
| `src/app/staff/finance/booklets/page.tsx` | Query via junction table |
