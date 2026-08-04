# COMPONENT_STANDARDS.md

> **Single source of truth for every reusable UI component in SRAMS.**
>
> Read this before generating or refactoring any component. When this document and an existing file disagree, **this document wins** — the existing file is drift to be corrected. When this document and `CLAUDE.md` architectural rules interact, `CLAUDE.md` owns _where logic lives_ (server actions/queries/pure utils) and this document owns _how the UI is composed_.

---

## 0. Prime Directives

1. **Semantic tokens only. Never hardcode palette utilities.** Use `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-card`, `bg-muted`, `border-border`, `bg-primary`, `text-primary`, and the status tokens in §9. **Never** write `text-gray-600`, `bg-amber-500`, `text-red-600`, etc. in feature code. Every hardcoded palette class is a dark-mode bug waiting to happen (the codebase currently carries ~877 of these against only ~265 `dark:` variants — do not add to that number).
2. **Compose primitives; never re-implement them.** If `@/components/ui` exports it, import it. Do not hand-roll a `<div className="rounded-xl border...">` when `<Card>` exists, or `<button className="btn-primary">` when `<Button>` exists.
3. **UI components hold UI state only.** No business logic, no DB calls, no fetching inside client components. Data arrives as props from a server component; mutations go through a server action prop. (Per `CLAUDE.md`.)
4. **One component per concept, parameterized by `mode`/`variant` — not copy-pasted.** No `XForm` + `EditXForm` twins. No four near-identical tables. See §4, §5.
5. **Every list/detail surface that can be empty has an explicit empty state, and every async boundary has a skeleton.** No bare spinners on full pages, no "nothing here" blank screens. See §10–§12.

---

## 1. Folder Structure

```
src/
├── components/
│   ├── ui/                    # PRIMITIVES — dumb, generic, zero feature knowledge
│   │   ├── button.tsx         #   Button, buttonVariants
│   │   ├── badge.tsx          #   Badge (generic variant styling)
│   │   ├── card.tsx           #   Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
│   │   ├── dialog.tsx         #   Dialog family (modal)
│   │   ├── alert-dialog.tsx   #   AlertDialog family (confirm/destructive)
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx          #   Input, Textarea, Label, Select primitives
│   │   ├── select.tsx
│   │   ├── skeleton.tsx       #   Skeleton primitive
│   │   ├── spinner.tsx        #   Spinner (inline only)
│   │   ├── stat-card.tsx      #   StatCard (dashboard metric)
│   │   ├── TablePagination.tsx
│   │   ├── Pagination.tsx
│   │   ├── StatusBadge.tsx    #   ← ADD: domain-aware status → variant mapper (§9)
│   │   ├── DataTable.tsx      #   ← ADD: the one generic TanStack table (§4)
│   │   ├── EmptyState.tsx     #   ← ADD: (§11)
│   │   ├── PageHeader.tsx     #   ← ADD: (§7)
│   │   ├── ActionBar.tsx      #   ← ADD: (§13)
│   │   ├── ThemeToggle.tsx
│   │   └── index.ts           #   Barrel export — every primitive re-exported here
│   │
│   ├── shared/                # CROSS-FEATURE composites built FROM primitives
│   │   ├── ConfirmActionButton.tsx   # exists — the confirm-then-server-action button
│   │   ├── EntityForm.tsx            # ← ADD: generic create/edit form shell (§5)
│   │   ├── FormField.tsx             # ← ADD: label + control + error + hint (§5)
│   │   └── AppShell.tsx              # ← ADD: layout shell replacing admin/portal/staff triplication (§7)
│   │
│   └── layout/                # nav + chrome (sidebar-nav, etc.)
│
└── features/<feature>/
    └── components/            # FEATURE components — may know about the feature's types,
                              # compose ui/ + shared/, receive data via props, call actions via props.
```

**Placement rule of thumb:**

| If the component…                                                                  | It goes in…                      |
| ---------------------------------------------------------------------------------- | -------------------------------- |
| knows nothing about the domain (a button, a table shell, a badge)                  | `components/ui/`                 |
| is reused across ≥2 features and composes primitives (confirm button, entity form) | `components/shared/`             |
| knows a feature's types or wires a specific action/query                           | `features/<feature>/components/` |

**Every primitive is exported from `components/ui/index.ts`.** Feature code imports from the barrel: `import { Button, Card, DataTable, StatusBadge } from "@/components/ui"`.

---

## 2. Component Composition Rules

1. **Server component by default.** A file is a Server Component unless it needs interactivity, in which case it opens with `"use client"`. Push the `"use client"` boundary as deep as possible — a page shell stays server; only the interactive leaf (a table with sorting, a form) is a client component.
2. **Data flows down as props; events flow up as action props.** A client table receives `rows: T[]` and (if it mutates) an `action` prop typed as a server action. It never imports a `.queries.ts` or calls `fetch`.
3. **No prop drilling past two levels.** If a value crosses three components untouched, colocate the consumer or lift to a context provider in `features/<feature>/context/`.
4. **Presentational vs. connected.** A "connected" component (fetches via being a server component, or wires an action) wraps a "presentational" one that only takes props. Keep the presentational core reusable and testable.
5. **`className` is always the last-merged prop** via `cn(...)` so callers can override. Never spread `{...props}` before `className`.
6. **No inline `style={{}}` for anything themeable.** Inline style is allowed only for computed dynamic values that cannot be expressed as a class (e.g. a progress bar width `%`). Color, spacing, radius, shadow → classes/tokens.

---

## 3. Props Conventions

- **Naming**
  - Booleans read as adjectives/state: `isLoading`, `isPending`, `disabled`, `readOnly`, `defaultChecked`. Not `loading` for domain flags — but note the primitive `Button` uses `loading` for its spinner; keep that name for the primitive, use `isPending` in feature code.
  - Event handlers: `onX` (`onSuccess`, `onSelect`, `onOpenChange`). Server actions passed as props: `action`.
  - Render slots: `renderRow`, `renderEmpty`, `header`, `footer`, `actions`.
- **Types**
  - Every component has an explicit `Props` interface named `<Component>Props`, exported when the component is a primitive or shared.
  - Prefer discriminated unions over boolean soup. A create/edit form takes `mode: "create" | "edit"` with `mode: "edit"` additionally requiring `initialValues` — model that as a union, not two optional props.
  - Data shapes come from the feature's Zod inferred types or query return types — **never redeclare a row shape inline**. `type Row = Awaited<ReturnType<typeof getX>>[number]`.
- **Defaults** via destructuring defaults, not `defaultProps`.
- **`children` vs. explicit slots.** Use `children` for the single obvious content area; use named `ReactNode` props (`actions`, `footer`) when there are multiple insertion points.
- **Server-action prop signature is standardized:**
  ```ts
  action: (prevState: BaseFormState, formData: FormData) =>
    Promise<BaseFormState>;
  ```
  This matches `useActionState` and the existing `ConfirmActionButton`.

---

## 4. DataTable Standard

**Problem it solves:** `EnrollmentStatusTables.tsx` alone carries four near-identical TanStack tables; the same shape recurs across the app. There must be exactly **one** generic table.

**The primitive:** `components/ui/DataTable.tsx` — a generic client component over `@tanstack/react-table`.

```ts
"use client";

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Stable row id extractor. Required — never fall back to index. */
  getRowId: (row: T) => string;
  /** Empty-state config; DataTable renders <EmptyState> when data is []. */
  empty: {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: ReactNode;
  };
  /** Server-driven pagination. Omit for client-only small tables. */
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    pageSize: number;
    baseUrl: string;
    pageParam?: string;
  };
  /** Optional per-row action menu (⋮). */
  rowActions?: (row: T) => ReactNode;
  isLoading?: boolean;
  className?: string;
}
```

**Rules:**

1. Feature code provides a `columns` array (via `useMemo`) and a `getRowId` — nothing else. It does **not** re-implement `<table>`, header rendering, sorting glue, or pagination.
2. `DataTable` renders its own **loading** (skeleton rows, §10), **empty** (`<EmptyState>`, §11), and **populated** states. Callers never branch on these.
3. **Pagination is server-driven by default** via URL params (`?page=`), using the existing `TablePagination`. `pageParam` lets two tables coexist on one page. Client-side pagination is only for small, fully-loaded datasets.
4. **Status cells use `<StatusBadge>` (§9), never ad-hoc colored spans.**
5. **Row actions** live in a `⋮` `DropdownMenu`; destructive actions inside route through `ConfirmActionButton`.
6. The four `EnrollmentStatusTables` become four `columns` definitions passed to one `<DataTable>`. Same for every other table.

**Column definition convention:**

```ts
const columns = useMemo<ColumnDef<EnrolledStudent>[]>(() => [
  { accessorKey: "referenceNumber", header: "Ref #" },
  { accessorKey: "fullName", header: "Student" },
  { id: "status", header: "Status",
    cell: ({ row }) => <StatusBadge domain="enrollment" value={row.original.status} /> },
  { id: "actions", header: "", cell: ({ row }) => rowActions(row.original) },
], [rowActions]);
```

---

## 5. Form Standard

**Current drift to eliminate:** two competing form styles exist — the primitive-based path (`Button`, semantic tokens) and a legacy global-CSS path (`className="form-control"`, `className="btn-primary"`, raw `<button>`). **The legacy global-class form style is deprecated.** All new forms, and all touched forms, use the standard below. Create/Edit twins (`UserForm`/`EditUserForm`, `SchoolYearForm`/`EditSchoolYearForm`) collapse into one component.

**Two building blocks:**

### 5.1 `FormField` (`components/shared/FormField.tsx`)

Wraps label + control + error + hint consistently. Never re-declare this markup per field.

```ts
interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string; // first error string for this field
  hint?: string;
  children: ReactNode; // the control (Input/Select/Textarea primitive)
}
```

Renders: `<Label>` (with a `*` when `required`), the control, an inline `text-destructive` error when present, a `text-muted-foreground` hint otherwise.

### 5.2 `EntityForm` (`components/shared/EntityForm.tsx`)

The generic create/edit shell. Owns `useActionState`, error surfacing, the success redirect/callback, and the action bar (§13). Feature forms provide only their fields.

```ts
interface EntityFormProps<TState extends BaseFormState> {
  action: (prev: TState, fd: FormData) => Promise<TState>;
  initialState: TState;
  mode: "create" | "edit";
  submitLabel?: { create: string; edit: string };
  onSuccess?: (state: TState) => void; // e.g. router.push to detail
  cancelHref?: string;
  children: (ctx: { state: TState; isPending: boolean }) => ReactNode; // fields
}
```

**Rules:**

1. **Single component per entity.** `CurriculumForm mode="create" | "edit"`, not two files. `mode="edit"` supplies `defaultValue`s from `initialValues`.
2. **Zod schema is the single source of truth** for validation (per `CLAUDE.md`); client `required`/`type` attributes are UX hints only — the server action re-validates.
3. **Form-level errors** (`state.errors?._form`, `state.message` when `!success`) render in one alert block at the top.
4. **Field errors** render inline via `FormField error={state.errors?.field?.[0]}`.
5. **Submit uses the `Button` primitive** with `loading={isPending}` and a `mode`-aware label. Cancel is `variant="secondary"`. Never `<button className="btn-primary">`.
6. **Layout:** two-column responsive grid (`grid gap-4 sm:grid-cols-2`), full-width fields span both columns via `sm:col-span-2`. No global `.form-grid` classes.
7. **Controls come from primitives:** `Input`, `Textarea`, `Select`, `Label`. If a primitive is missing (e.g. no `Checkbox` primitive yet), add it to `components/ui/` first, then use it — do not inline a raw styled `<input>`.

**Reference shape:**

```tsx
<EntityForm
  action={action}
  initialState={initialState}
  mode={mode}
  submitLabel={{ create: "Create User", edit: "Save Changes" }}
  onSuccess={(s) => router.push(`/admin/users/${s.userId}`)}
  cancelHref="/admin/users"
>
  {({ state }) => (
    <>
      <FormField
        label="Email"
        htmlFor="email"
        required
        error={state.errors?.email?.[0]}
      >
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initialValues?.email}
        />
      </FormField>
      <FormField
        label="Role"
        htmlFor="role"
        required
        error={state.errors?.role?.[0]}
      >
        <Select id="role" name="role" defaultValue={initialValues?.role}>
          {/* options */}
        </Select>
      </FormField>
    </>
  )}
</EntityForm>
```

---

## 6. Dialog Standard

Two families exist and must be used for their distinct purposes — do not mix them.

| Use                                                | Component                               | For                                                                                   |
| -------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| **AlertDialog** (`components/ui/alert-dialog.tsx`) | destructive / irreversible confirmation | Delete, archive, void, cancel — anything the user could regret. Blocks until decided. |
| **Dialog** (`components/ui/dialog.tsx`)            | content modal                           | Create/edit-in-modal, multi-step flows (publish + adopt), pickers. Dismissible.       |

**Rules:**

1. **Destructive confirmations go through `ConfirmActionButton`** (already built) rather than assembling `AlertDialog` by hand each time. It owns the confirm → server-action → pending → success flow.
2. **Controlled open state** via `open` / `onOpenChange`. Never leave a dialog uncontrolled if a successful action should close it.
3. **A dialog closes on action success**, driven by the action state (`useEffect` on `state.success`), and shows a toast. It never closes optimistically before the server confirms.
4. **Titles are imperative** ("Archive curriculum?", "Add subject"). Descriptions state the consequence, especially for destructive actions ("This cannot be undone. Grade history is preserved.").
5. **Footer button order:** Cancel (`secondary`) left, primary/destructive action right. Destructive actions use `Button variant="danger"`.
6. **Forms inside dialogs** still use `EntityForm`/`FormField` — the dialog is only the container.
7. **Max one primary action per dialog.**

---

## 7. Page Layout Standard

**Drift to eliminate:** `admin/layout.tsx`, `portal/layout.tsx`, `staff/layout.tsx` are ~80 lines each, ~61 shared. Collapse into one `AppShell`.

### 7.1 `AppShell` (`components/shared/AppShell.tsx`)

One layout shell, parameterized by nav config + role. Sidebar items are **derived from the RBAC permission map**, not hand-listed per role (so the sidebar can never disagree with `lib/rbac/permissions.ts`).

```ts
interface AppShellProps {
  session: SessionPayload; // for role-gated nav
  children: ReactNode;
}
```

The three route-group layouts (`app/admin/layout.tsx`, etc.) become thin wrappers that call `<AppShell session={...}>`.

### 7.2 Page anatomy

Every page follows the same vertical rhythm:

```
<PageHeader
  title="Curriculums"
  description="Manage subjects per grade level."
  breadcrumbs={[...]}
  actions={<Button>New Curriculum</Button>}   // the page's ActionBar (§13)
/>
<main className="space-y-6">
  {/* filters / stat row / table / detail sections */}
</main>
```

- **`PageHeader` (`components/ui/PageHeader.tsx`)** owns: title (`font-display text-2xl font-bold text-foreground`), optional description (`text-muted-foreground`), breadcrumbs, and a right-aligned `actions` slot. No page re-implements the header row.
- **Content width & spacing:** page content is vertical `space-y-6`; sections are `<Card>`s or bare regions with `CardHeader`-style titles.
- **Reusable page templates** live in `src/app/page-templates/<feature>/` mirroring existing enrollment/student templates, so route files stay thin (fetch data in the route's server component, pass to the template).

---

## 8. Card Standard

Use the `Card` family (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) — already defined on semantic tokens (`bg-card`, `border-border`, `rounded-xl shadow-sm`).

**Rules:**

1. **Never hand-roll a card.** No `<div className="rounded-xl border bg-white p-6">`. Import `Card`.
2. **Structure:** `CardHeader` (title + description) → `CardContent` → optional `CardFooter` (actions). Don't put a raw `<h3>` where `CardTitle` belongs.
3. **Padding is owned by the card parts** (`CardHeader`/`CardContent` already pad `p-6`). Don't add your own `p-6` inside.
4. **Metric cards use `StatCard`, not `Card`.** `StatCard` (§14) is the dashboard metric primitive with icon, label, value, subtext. Regular `Card` is for content regions.
5. **Interactive cards** (clickable) get `hover:shadow-md transition-shadow` (already the base) and a real focusable element inside — don't put `onClick` on the bare card div without keyboard access.
6. **Card titles** are `CardTitle` (`text-lg font-semibold`); section descriptions are `CardDescription` (`text-sm text-muted-foreground`).

---

## 9. Status Badge Variants

**Drift to eliminate:** status coloring is currently ad-hoc and hardcoded across features. There is a generic `Badge` primitive with variants `success | danger | warning | info | secondary` — but domain code should **not** pick the variant inline (that's how a `posted` payment ends up `emerald` in one table and `green-600` in another). Add a domain-aware mapper.

### 9.1 `StatusBadge` (`components/ui/StatusBadge.tsx`)

```ts
type Domain =
  | "payment"
  | "enrollment"
  | "billing"
  | "invoice"
  | "document"
  | "clearance"
  | "curriculum"
  | "voidRequest"
  | "grade";

interface StatusBadgeProps {
  domain: Domain;
  value: string; // the raw pg enum value
  className?: string;
}
```

Internally, one exhaustive map per domain resolves `(domain, value) → { variant, label }`, then renders `<Badge variant={variant}>{label}</Badge>`. Because the maps key off the pg enums, **the TypeScript compiler fails the build when an enum gains a value the map doesn't handle** — the badge can never silently fall behind the schema. This is the whole point.

### 9.2 Canonical semantics (`Badge` variant vocabulary)

| variant     | meaning                    | typical statuses                                                 |
| ----------- | -------------------------- | ---------------------------------------------------------------- |
| `success`   | terminal-good / active     | `posted`, `paid`, `enrolled`, `cleared`, `published`, `approved` |
| `warning`   | needs action / in-progress | `pending`, `partial`, `draft`, `submitted`, `overdue-soon`       |
| `danger`    | terminal-bad / blocked     | `void`, `cancelled`, `rejected`, `overdue`, `unpaid`             |
| `info`      | neutral-notable            | `sent`, `transferred`, `in_review`, `upcoming`                   |
| `secondary` | inert / default            | `archived`, `closed`, unknown fallbacks                          |

**Rules:**

1. **Never pass `variant` to `Badge` directly in feature code.** Feature code uses `<StatusBadge domain="…" value={…} />`. Raw `Badge` with an explicit variant is only for genuinely non-status labels (e.g. a "Core" subject tag).
2. **Labels are humanized centrally** in the map (`balance_forward` → "Balance Forward"), never `.replace(/_/g," ")` at call sites.
3. **Add the domain's `dark:` variants once, in `Badge`** (already present) — feature code inherits them for free.

---

## 10. Skeleton Patterns

Use the `Skeleton` primitive (`components/ui/skeleton.tsx`) — an animated `bg-muted rounded` block. **Skeletons mirror the shape of the content they replace.** A skeleton must never be a generic gray box where a table will appear.

**Standard skeletons (add to `components/ui/skeleton.tsx` as named exports):**

- `TableSkeleton` — header row + N body rows matching the real column count/widths. `DataTable` renders this when `isLoading`.
- `CardSkeleton` — a `Card` with a title bar + 2–3 muted lines.
- `StatCardSkeleton` — matches `StatCard` footprint (label line, big value line, icon square).
- `DetailSkeleton` — header block + two-column field grid.
- `FormSkeleton` — label+control pairs.

**Rules:**

1. **Row/field counts match the real layout** so there's no reflow jump when data lands.
2. Skeletons use `bg-muted` + the existing `animate-*` — never a hardcoded gray.
3. Prefer skeletons over spinners for any surface bigger than a button. Spinners are for inline/button-scoped waits only (§11).

---

## 11. Loading States

Three tiers, chosen by scope:

| Scope                           | Pattern                                                                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route segment**               | `app/**/loading.tsx` returning the page's composed skeletons. (14 exist — every data route should have one.)                                                                                                                                 |
| **In-page async region**        | Wrap in `<Suspense fallback={<XSkeleton/>}>`. Stream each region independently — a dashboard's slow widget must not block the fast ones. (Only ~6 `<Suspense>` exist today against 14 `loading.tsx`; increase Suspense usage for streaming.) |
| **Action-scoped (button/form)** | `Button loading={isPending}` (built-in spinner) and disabled controls. Use the `Spinner` primitive only for inline, non-full-page waits.                                                                                                     |

**Rules:**

1. **Never a bare full-page spinner.** A page-level wait renders skeletons via `loading.tsx`, not a centered `Spinner`.
2. **Dashboards wrap each metric/section in its own `Suspense`** so `Promise.all` fan-out streams progressively instead of blocking on the slowest query.
3. **Optimistic UI** (`useOptimistic`) is allowed for low-risk toggles, but **never for financial mutations** — those wait for server confirmation (per the accounting-correctness rules).
4. **Disable, don't hide, during submit.** Keep the layout stable; disable the submit button and show its loading label.

---

## 12. Empty States

Every collection surface renders an explicit empty state when there are zero rows — never a blank region or an empty table body.

### `EmptyState` (`components/ui/EmptyState.tsx`)

```ts
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode; // primary CTA, e.g. <Button>New Curriculum</Button>
  className?: string;
}
```

Renders a centered `Card`-less region: muted icon in a `bg-muted` circle, `text-foreground` title, `text-muted-foreground` description, optional CTA.

**Rules:**

1. **`DataTable` renders `EmptyState` automatically** from its `empty` prop — feature tables don't branch on `data.length`.
2. **Distinguish "empty" from "no results".** A never-populated list gets an onboarding empty state with a CTA ("Create your first curriculum"). A filtered list with no matches gets a "no results" variant with a "Clear filters" action — different copy, same component.
3. **One primary action max.** The empty state's CTA is the single obvious next step.
4. **Copy is specific and encouraging**, never "No data." Say what the thing is and how to make one.

---

## 13. Action Bars

An **ActionBar** is the horizontal cluster of buttons attached to a page header, card footer, form, or table toolbar. Standardize it so button ordering, spacing, and variant usage never drift.

### `ActionBar` (`components/ui/ActionBar.tsx`)

```ts
interface ActionBarProps {
  children: ReactNode; // Button primitives
  align?: "start" | "end" | "between"; // default "end"
  className?: string;
}
```

Renders `flex items-center gap-2` with the chosen justification.

**Rules:**

1. **Ordering (left→right):** secondary/tertiary actions first, **primary action last (rightmost)**. Destructive actions are visually separated (a spacer or a divider) from safe actions.
2. **At most one `primary` button** per bar. Everything else is `secondary`/`ghost`. Destructive is `danger`/`danger-outline`.
3. **Page-level action bar lives in `PageHeader`'s `actions` slot** (§7); form action bar is owned by `EntityForm` (§5); card actions live in `CardFooter`.
4. **Destructive actions route through `ConfirmActionButton`**, never a bare `Button` that fires immediately.
5. **Responsive:** on narrow viewports, the bar wraps or collapses secondary actions into a `⋮` `DropdownMenu`; the primary action stays visible.
6. **Icon + label** for primary actions where an icon clarifies (`<Plus/> New Curriculum`); icon-only buttons must carry an `aria-label`.

---

## 14. Dashboard Widgets

Dashboards are composed from a small, fixed widget vocabulary — not bespoke layouts per role.

### 14.1 `StatCard` (exists — `components/ui/stat-card.tsx`)

The metric primitive: `label`, `value`, `subtext?`, `iconType`. Icon set is centralized (`STAT_ICONS`). Uses `bg-card`, `text-primary`, `bg-primary/10`, `font-display` — all tokenized.

**Rules:**

1. **All dashboard metrics use `StatCard`.** Never hand-build a metric tile.
2. **Extend the icon set centrally** (`STAT_ICONS`) rather than passing raw icon components — keeps dashboards visually consistent and typed (`StatIconType`).
3. **Stat rows are responsive grids:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.

### 14.2 Widget family (add as needed, all in `components/ui/` or a `components/dashboard/`)

| Widget           | Purpose                               | Notes                                                                                            |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `StatCard`       | single metric                         | exists                                                                                           |
| `ChartCard`      | a `Card` wrapping a Recharts chart    | chart colors come from CSS-var tokens, **not** hardcoded hex; provide a `--chart-1..n` token set |
| `ListWidget`     | "recent X" / "pending Y" compact list | rows link to the entity; empty state via `EmptyState`                                            |
| `ProgressWidget` | ratio/goal (e.g. collection rate)     | the one place a computed inline `width: %` style is acceptable                                   |

**Rules:**

1. **Each widget is independently Suspense-wrapped** with a matching skeleton so the dashboard streams (§11).
2. **Chart theming uses tokens.** Add `--chart-1` … `--chart-n` to the CSS variables and reference them; never inline palette hex in Recharts `fill`/`stroke`. This is what makes charts dark-mode-correct and rebrandable.
3. **Widgets receive already-computed data as props** from server queries — no aggregation, formatting-to-currency, or date math inside the widget (per `CLAUDE.md`, that's util/query territory).
4. **Number/currency/date formatting** goes through shared formatters (`lib/utils/format.*`), never `toLocaleString` scattered in widgets.

---

## 15. Theming Tokens (reference)

Use these; never their hardcoded equivalents.

| Purpose                 | Token classes                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Text                    | `text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`       |
| Surfaces                | `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-primary/10`                |
| Borders                 | `border-border`, `border-primary`, `border-destructive`                              |
| Status (add if missing) | `--success`, `--warning`, `--info` + `-subtle` background variants for badges/alerts |
| Charts (add)            | `--chart-1` … `--chart-n`                                                            |
| Type scale              | `font-display` (headings/metrics), default sans (body)                               |

**Migration note:** the ~877 existing hardcoded palette utilities are tech debt. When you touch a component, convert its colors to tokens in the same change (boy-scout rule). Do not add new hardcoded palette classes under any circumstance.

---

## 16. Definition of Done (per component)

A reusable component is "done" when:

1. It composes existing primitives; it re-implements none of them.
2. It uses **only** semantic tokens — zero hardcoded palette classes, and it renders correctly in dark mode without extra work.
3. It has an explicit exported `Props` interface; data shapes derive from Zod/query types, not inline redeclarations.
4. It holds UI state only — no fetching, no DB, no business logic.
5. If it's a collection surface: it has skeleton, empty, and populated states.
6. If it mutates: destructive paths go through `ConfirmActionButton`; submit shows a loading state; success is server-confirmed (never optimistic for money).
7. It's exported from `components/ui/index.ts` if it's a primitive.
8. There is exactly one of it — no create/edit twin, no near-duplicate table, no copy-pasted card.

---

## 17. Anti-Patterns (reject in review)

- `className="btn-primary"` / `className="form-control"` / global form CSS classes → use `Button` / `FormField` primitives.
- `text-gray-600`, `bg-amber-500`, any `-{50..950}` palette class in feature code → semantic token.
- A second `XForm` + `EditXForm` pair → one `EntityForm mode`.
- A new hand-built TanStack `<table>` → `DataTable`.
- `<Badge variant="success">` chosen inline for a status → `StatusBadge domain value`.
- A full-page `<Spinner/>` while loading → route `loading.tsx` with skeletons.
- An empty table body when `data.length === 0` → `EmptyState`.
- Inline `status.replace(/_/g, " ")` labeling → central label map in `StatusBadge`.
- Recharts with hardcoded hex colors → chart tokens.
- Fetching or DB access inside a `"use client"` component → move to a server component, pass props.
