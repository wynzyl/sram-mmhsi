# Theme & Styling Consolidation Plan

## Objective

Consolidate 8 styling systems into a **single centralized theme** using **Tailwind CSS 4 + shadcn/ui + tw-animate-css**.

---

## User Decisions

| Decision           | Choice                                                          |
| ------------------ | --------------------------------------------------------------- |
| Login page styling | **Merge into main theme** (no isolated .login-\* classes)       |
| Migration approach | **Create new components** (FinancePanel, OperationsTable, etc.) |
| Priority phases    | **Phase 1 → Phase 4 → Phase 2** (defer Phase 3)                 |

---

## Current State → Target State

| System                | Lines        | Action                                 |
| --------------------- | ------------ | -------------------------------------- |
| CSS Custom Properties | ~220 vars    | Keep **core shadcn tokens only** (~50) |
| Tailwind 4 @theme     | ~50 lines    | Keep & expand                          |
| CSS Utility Classes   | ~1,200 lines | **Create components**                  |
| Login Page Theme      | ~390 lines   | **Merge into main theme**              |
| ledger-register.css   | 575 lines    | **Delete → LedgerRegister component**  |
| sidebar.css           | 239 lines    | **Delete → Inline Tailwind**           |

**Result: globals.css ~300 lines** (down from ~2,400)

---

## Implementation Phases (Priority Order)

### Phase 1: Foundation Cleanup ⭐ START HERE

**Risk: Low | Files: ~20**

#### Step 1.1: Clean globals.css imports

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

#### Step 1.2: Remove legacy CSS variable aliases

Find/replace across codebase:

| Legacy Variable           | Tailwind Class                |
| ------------------------- | ----------------------------- |
| `var(--color-surface)`    | `bg-card`                     |
| `var(--color-surface-2)`  | `bg-muted`                    |
| `var(--color-text)`       | `text-foreground`             |
| `var(--color-text-muted)` | `text-muted-foreground`       |
| `var(--color-border)`     | `border-border`               |
| `var(--color-primary)`    | `text-primary` / `bg-primary` |
| `var(--color-error)`      | `text-destructive`            |
| `var(--color-success)`    | `text-emerald-600`            |

#### Step 1.3: Migrate animations to tw-animate-css

| Custom Animation            | tw-animate-css                              |
| --------------------------- | ------------------------------------------- |
| `animate-fade-in`           | `animate-in fade-in`                        |
| `animate-fadeUp`            | `animate-in fade-in slide-in-from-bottom-2` |
| `animate-reveal-stagger`    | `animate-in fade-in duration-300`           |
| `@keyframes skeleton-pulse` | `animate-pulse` (built-in)                  |

**Files to modify:**

- `src/app/globals.css` - Remove custom @keyframes
- Components using custom animation classes

---

### Phase 4: Quick Wins - Delete CSS Files ⭐ SECOND

**Risk: Medium | Files: 3**

#### Step 4.1: Inline sidebar.css → Sidebar.tsx

**Current:** `src/components/layout/sidebar.css` (239 lines, 24 classes)
**Action:** Convert to Tailwind inline classes

```tsx
// Before: className="sidebar"
// After:
className="fixed left-0 top-0 h-screen w-[220px] bg-gradient-to-b
           from-card to-muted border-r border-border flex flex-col"

// Before: className="nav-link active"
// After:
className="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm
           bg-primary/10 text-primary border-l-2 border-primary"

// Before: className="sidebar-footer"
// After:
className="mt-auto p-4 border-t border-border"
```

**Delete:** `src/components/layout/sidebar.css`
**Update:** Remove import from Sidebar.tsx

#### Step 4.2: Create LedgerRegister component

**Current:** `src/app/ledger-register.css` (575 lines)
**Action:** Create new component with Tailwind

**New file:** `src/components/finance/LedgerRegister.tsx`

```tsx
// Compound component pattern
export function LedgerRegister({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6">{children}</div>;
}

export function LedgerHeader({ student, balance }: LedgerHeaderProps) {
  return (
    <div className="flex items-start justify-between p-4 bg-card rounded-lg border border-border">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <p className="text-sm text-muted-foreground">{student.gradeLevel}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">{/* KPI tiles */}</div>
    </div>
  );
}

export function LedgerTable({ items }: LedgerTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Description</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{/* rows */}</tbody>
      </table>
    </div>
  );
}
```

**Delete:** `src/app/ledger-register.css`
**Update:** `AssessmentLedgerRegister.tsx` to use new component

---

### Phase 2: Forms & Layout Components ⭐ THIRD

**Risk: Medium | Files: ~45**

#### Step 2.1: Create FormControl component

**New file:** `src/components/ui/form-control.tsx`

```tsx
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface FormControlProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
}

export const FormControl = forwardRef<HTMLInputElement, FormControlProps>(
  ({ label, error, description, className, id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full px-3 py-2.5 text-sm rounded-md",
            "border border-input bg-background",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus:ring-destructive/30",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);
FormControl.displayName = "FormControl";
```

#### Step 2.2: Migrate Login page to main theme

**File:** `src/app/login/page.tsx` and `src/features/auth/components/LoginForm.tsx`

```tsx
// Before: className="login-page"
// After:
className="min-h-screen flex items-center justify-center p-4
           bg-gradient-to-br from-background via-muted/50 to-background"

// Before: className="login-card"
// After: Use shadcn Card
<Card className="w-full max-w-md shadow-lg">
  <CardHeader className="text-center space-y-2">
    <h1 className="text-2xl font-serif font-bold text-primary">SRAMS</h1>
    <p className="text-sm text-muted-foreground">School Management System</p>
  </CardHeader>
  <CardContent>
    {/* form */}
  </CardContent>
</Card>

// Before: className="login-input"
// After: Use FormControl or shadcn Input
<FormControl label="Email" type="email" error={errors.email} />
```

#### Step 2.3: Create PageLayout components

**New file:** `src/components/layout/page-layout.tsx`

```tsx
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-8 max-w-[1400px] mx-auto", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

---

### Phase 3: Finance Components (DEFERRED)

**Risk: High | Files: ~30**

Create these components when ready:

- `FinancePanel` - replaces `.fin-panel-*` (85 classes)
- `FinanceTable` - replaces `.fin-table-*`
- `OperationsPanel` - replaces `.ops-*` (32 classes)
- `FeeItemCard` - replaces `.fit-*` (48 classes)

---

### Phase 5: Color Utilities Cleanup

**Risk: Low | Files: 2**

**File:** `src/lib/utils/financial-colors.ts`

```tsx
// Simplified - use semantic Tailwind classes
export function getBalanceColor(balance: number) {
  if (balance === 0) return "text-emerald-600 dark:text-emerald-400";
  if (balance > 0) return "text-destructive";
  return "text-muted-foreground";
}

export function getPaymentStatusColor(status: string) {
  const colors = {
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    partial:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}
```

---

### Phase 6: Final Cleanup

**Risk: Low | Files: ~5**

1. Remove all unused CSS from globals.css
2. Delete legacy `--color-*` variables
3. Update CLAUDE.md styling guidelines
4. Run `npm run build` to verify

---

## New globals.css Structure (~300 lines)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ── Core Theme Tokens ─────────────────────────────────────── */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.45 0.2 25);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-serif: "Crimson Pro", Georgia, serif;
  --font-mono: "IBM Plex Mono", monospace;
  --radius: 0.375rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark overrides */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... bridge all tokens */
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
}

@media print {
  .no-print {
    display: none !important;
  }
}
```

---

## Files to Create

| File                                        | Purpose                     |
| ------------------------------------------- | --------------------------- |
| `src/components/ui/form-control.tsx`        | Form input with label/error |
| `src/components/layout/page-layout.tsx`     | PageContainer, PageHeader   |
| `src/components/finance/LedgerRegister.tsx` | Ledger compound component   |

## Files to Delete

| File                                | Replaced By                    |
| ----------------------------------- | ------------------------------ |
| `src/components/layout/sidebar.css` | Inline Tailwind in Sidebar.tsx |
| `src/app/ledger-register.css`       | LedgerRegister component       |

## Files to Modify

| File                                         | Changes                         |
| -------------------------------------------- | ------------------------------- |
| `src/app/globals.css`                        | Reduce from ~2,400 → ~300 lines |
| `src/components/layout/Sidebar.tsx`          | Inline Tailwind classes         |
| `src/features/auth/components/LoginForm.tsx` | Use shadcn Card + FormControl   |
| `src/app/login/page.tsx`                     | Merge login theme               |
| `src/lib/utils/financial-colors.ts`          | Simplify to Tailwind classes    |

---

## Verification Plan

After each phase:

1. `npm run build` - No TypeScript/CSS errors
2. `npm run dev` - Visual inspection
3. Toggle light/dark mode
4. Test responsive breakpoints
5. Screenshot comparison

---

## Summary

| Phase       | Description                              | Risk   | Priority      |
| ----------- | ---------------------------------------- | ------ | ------------- |
| **Phase 1** | Foundation cleanup, animation migration  | Low    | ⭐ First      |
| **Phase 4** | Delete sidebar.css + ledger-register.css | Medium | ⭐ Second     |
| **Phase 2** | Forms, Login page, PageLayout            | Medium | ⭐ Third      |
| Phase 3     | Finance components                       | High   | Deferred      |
| Phase 5     | Color utilities                          | Low    | After Phase 2 |
| Phase 6     | Final cleanup                            | Low    | Last          |

**Estimated: ~8-10 days for Phases 1, 4, 2**
