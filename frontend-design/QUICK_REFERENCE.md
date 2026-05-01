# SRAMS Design System - Quick Reference

## Component Import Cheatsheet

```tsx
// UI Primitives
import { Button, Badge, Input, Card, Spinner } from "@/components/ui";

// Forms
import { FormField, FormSection, FormActions } from "@/components/forms";

// Data Display
import {
  DataTable,
  StatusBadge,
  CurrencyDisplay,
  ReferenceCode
} from "@/components/data-display";

// Layout
import { PageHeader, PageContainer } from "@/components/layout";

// Providers
import { ThemeProvider, useTheme } from "@/components/providers";

// Utilities
import { cn } from "@/lib/utils/cn";
import {
  getBalanceColor,
  getPaymentStatusColor
} from "@/lib/utils/financial-colors";
```

## Common Patterns

### Button Variants
```tsx
<Button variant="primary">Submit</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Edit</Button>
<Button variant="danger">Delete</Button>

// With loading state
<Button loading={isPending}>Saving...</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

### Badge Variants
```tsx
<Badge variant="success">Paid</Badge>
<Badge variant="danger">Unpaid</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Processing</Badge>
<Badge variant="secondary">Draft</Badge>
```

### StatusBadge Types
```tsx
// Payment status
<StatusBadge status="paid" type="payment" />
<StatusBadge status="partial" type="payment" />
<StatusBadge status="unpaid" type="payment" />

// Enrollment status
<StatusBadge status="enrolled" type="enrollment" />
<StatusBadge status="pending" type="enrollment" />
<StatusBadge status="withdrawn" type="enrollment" />

// OR status
<StatusBadge status="issued" type="or" />
<StatusBadge status="cancelled" type="or" />
<StatusBadge status="not_issued" type="or" />
```

### Form Field Pattern
```tsx
<FormField
  label="Field Name"
  required
  error={errors?.fieldName}
  hint="Optional helper text"
>
  <Input
    name="fieldName"
    error={!!errors?.fieldName}
    placeholder="Enter value..."
  />
</FormField>
```

### DataTable Pattern
```tsx
const columns: ColumnDef<DataType>[] = [
  {
    header: "Column Name",
    accessorKey: "propertyName",
  },
  {
    header: "Custom Cell",
    accessorKey: "amount",
    cell: ({ row }) => (
      <CurrencyDisplay amount={row.original.amount} />
    ),
  },
];

<DataTable
  columns={columns}
  data={items}
  searchable
  searchPlaceholder="Search..."
  pageSize={20}
/>
```

### Currency Display
```tsx
// Basic usage
<CurrencyDisplay amount={1500.50} />
// Output: ₱1,500.50

// Show sign for positive values
<CurrencyDisplay amount={500} showSign />
// Output: +₱500.00
```

### Reference Code
```tsx
<ReferenceCode code="OR-2024-001234" />
<ReferenceCode code="STU-2024-00567" />
```

### Page Layout Pattern
```tsx
export default function MyPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Page Title"
        description="Optional description"
        actions={
          <Button variant="primary">
            Add New
          </Button>
        }
      />

      {/* Page content */}
      <div className="space-y-6">
        {/* Your content here */}
      </div>
    </PageContainer>
  );
}
```

## CSS Variable Reference

### Colors
```css
/* Primary (Deep Red) */
--color-primary
--color-primary-50 to --color-primary-900

/* Accent (Green) */
--color-accent
--color-accent-50 to --color-accent-900

/* Surfaces */
--color-surface
--color-surface-2
--color-surface-3

/* Text */
--color-text
--color-text-2
--color-text-muted
--color-text-subtle

/* Borders */
--color-border
--color-border-2

/* Semantic */
--color-error
--color-warning
--color-success
--color-info
```

### Typography
```css
/* Font families */
--font-sans (Instrument Sans)
--font-mono (JetBrains Mono)

/* Font sizes */
--text-xs: 11px
--text-sm: 13px
--text-base: 14px
--text-lg: 16px
--text-xl: 18px
--text-2xl: 22px

/* Font weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Spacing
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
```

### Border Radius
```css
--radius-sm: 4px
--radius: 6px
--radius-lg: 8px
--radius-xl: 12px
```

### Motion
```css
/* Durations */
--duration-instant: 100ms
--duration-fast: 150ms
--duration-normal: 250ms
--duration-slow: 350ms

/* Easing */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

## Utility Classes

### Motion Utilities
```tsx
<div className="hover-lift">Lifts on hover</div>
<div className="hover-scale">Scales on hover</div>
<div className="transition-smooth">Smooth transitions</div>
<div className="transition-colors">Color transitions only</div>
```

### Animation Classes
```tsx
<div className="fade-in">Fades in on mount</div>
<div className="skeleton">Loading skeleton</div>
<div className="stagger-children">Children animate in sequence</div>
```

### Dark Mode Classes
```tsx
// Automatically handled by design tokens
// All components work in light/dark mode

// To toggle theme programmatically:
const { theme, setTheme } = useTheme();
setTheme("dark"); // or "light" or "system"
```

## Common Tailwind Classes to Use

### Layout
```tsx
className="space-y-4"        // Vertical spacing
className="space-x-4"        // Horizontal spacing
className="grid gap-4"       // Grid with gap
className="flex items-center justify-between"
```

### Responsive
```tsx
className="grid md:grid-cols-2 lg:grid-cols-3"
className="hidden md:block"
className="text-sm md:text-base"
```

### Colors (using CSS vars)
```tsx
className="text-[var(--color-text)]"
className="bg-[var(--color-surface)]"
className="border-[var(--color-border)]"
```

## Form Validation Pattern

```tsx
"use client";

import { useActionState } from "react";
import { myAction } from "@/actions/my-action";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";

export default function MyForm() {
  const [state, action, pending] = useActionState(myAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.errors?._form && (
        <div className="bg-red-100 text-red-700 border border-red-200 rounded-md p-4">
          {state.errors._form.map((err, i) => <p key={i}>{err}</p>)}
        </div>
      )}

      <FormField label="Name" required error={state.errors?.name}>
        <Input name="name" error={!!state.errors?.name} />
      </FormField>

      <FormActions
        submitLabel="Submit"
        loading={pending}
      />
    </form>
  );
}
```

## Testing Checklist

When implementing a new component:

- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Test responsive behavior (mobile, tablet, desktop)
- [ ] Test loading states
- [ ] Test error states
- [ ] Test empty states
- [ ] Verify color contrast (WCAG AA)
- [ ] Check console for warnings

## Common Mistakes to Avoid

❌ **Don't**: Hardcode colors
```tsx
<div className="bg-red-500">...</div>
```

✅ **Do**: Use semantic CSS variables
```tsx
<div className="bg-[var(--color-error)]">...</div>
```

---

❌ **Don't**: Create one-off form layouts
```tsx
<div className="mb-4">
  <label>Name</label>
  <input />
</div>
```

✅ **Do**: Use FormField
```tsx
<FormField label="Name">
  <Input name="name" />
</FormField>
```

---

❌ **Don't**: Format currency manually
```tsx
<span>₱{amount.toLocaleString()}</span>
```

✅ **Do**: Use CurrencyDisplay
```tsx
<CurrencyDisplay amount={amount} />
```

---

❌ **Don't**: Build tables from scratch
```tsx
<table>
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

✅ **Do**: Use DataTable
```tsx
<DataTable columns={columns} data={data} />
```

## Performance Tips

1. **Memoize column definitions** for DataTable:
   ```tsx
   const columns = useMemo(() => [...], [dependencies]);
   ```

2. **Use loading states** on buttons:
   ```tsx
   <Button loading={isPending}>Save</Button>
   ```

3. **Lazy load heavy components**:
   ```tsx
   const HeavyComponent = lazy(() => import("./HeavyComponent"));
   ```

4. **Avoid unnecessary re-renders**:
   ```tsx
   const MemoizedComponent = memo(MyComponent);
   ```

## Need Help?

- Check implementation examples in `/components/cashier/`
- Read full documentation in `IMPLEMENTATION_SUMMARY.md`
- Review design philosophy in `/frontend-design/SRAMS Frontend Design System Implementation Plan.md`
