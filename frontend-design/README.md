# SRAMS Frontend Design System

## What This Is

A production-grade, token-based design system for the School Registration and Account Monitoring System (SRAMS). Built with Next.js 16, Tailwind v4, and modern React patterns.

## Quick Start

### 1. Import What You Need

```tsx
// All components are available through barrel exports
import { Button, Input, Badge } from "@/components/ui";
import { FormField, FormActions } from "@/components/forms";
import { DataTable, StatusBadge, CurrencyDisplay } from "@/components/data-display";
import { PageHeader, PageContainer } from "@/components/layout";
```

### 2. Build a Form

```tsx
"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { myAction } from "@/actions/my-action";

export default function MyForm() {
  const [state, action, pending] = useActionState(myAction, {});

  return (
    <form action={action} className="space-y-4">
      <FormField label="Student Name" required error={state.errors?.name}>
        <Input name="name" error={!!state.errors?.name} />
      </FormField>

      <FormActions submitLabel="Save" loading={pending} />
    </form>
  );
}
```

### 3. Build a Table

```tsx
import { DataTable } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";

const columns = [
  { header: "Student", accessorKey: "name" },
  {
    header: "Balance",
    accessorKey: "balance",
    cell: ({ row }) => <CurrencyDisplay amount={row.original.balance} />
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => <StatusBadge status={row.original.status} type="payment" />
  },
];

export default function StudentsTable({ students }) {
  return <DataTable columns={columns} data={students} searchable />;
}
```

### 4. Build a Page Layout

```tsx
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function MyPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Page Title"
        description="Page description"
        actions={<Button>Add New</Button>}
      />

      {/* Your content here */}
    </PageContainer>
  );
}
```

## Documentation

- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Complete technical overview
- **[Quick Reference](./QUICK_REFERENCE.md)** - Component cheatsheet and common patterns
- **[Original Plan](./SRAMS%20Frontend%20Design%20System%20Implementation%20Plan.md)** - Design philosophy and architecture

## What's Included

### UI Primitives
- **Button** - 4 variants (primary, secondary, ghost, danger), 3 sizes, loading states
- **Badge** - 5 variants for status indicators
- **Input** - Text input with error states
- **Card** - Flexible card container with subcomponents
- **Spinner** - Loading indicator

### Form Components
- **FormField** - Label, input wrapper, error display, hints
- **FormSection** - Section container with title and description
- **FormActions** - Submit/cancel button wrapper with loading states

### Data Display
- **DataTable** - Sortable, filterable, paginated table (powered by TanStack Table)
- **StatusBadge** - Payment, enrollment, and OR status badges
- **CurrencyDisplay** - Philippine Peso formatter
- **ReferenceCode** - Monospace code display for IDs

### Layout
- **PageHeader** - Page title, description, actions
- **PageContainer** - Main content wrapper

### Providers
- **ThemeProvider** - Light/dark mode with system preference

## Design Tokens

All styles use CSS variables for easy theming:

```css
/* Colors */
--color-primary      /* Deep Red #9b1c1c */
--color-accent       /* Green #16a34a */
--color-surface      /* Background colors */
--color-text         /* Text colors */
--color-border       /* Border colors */

/* Typography */
--font-sans          /* Instrument Sans */
--font-mono          /* JetBrains Mono */
--text-xs to --text-2xl

/* Spacing */
--space-1 to --space-24

/* Motion */
--duration-instant to --duration-slow
--ease-out, --ease-in-out
```

## Key Features

✅ **Type Safe** - Full TypeScript support
✅ **Accessible** - WCAG AA compliant
✅ **Dark Mode** - Complete dark mode support
✅ **Responsive** - Mobile-first design
✅ **Tree Shakeable** - Import only what you need
✅ **Professional** - Distinctive typography (Instrument Sans)
✅ **Financial Focus** - Specialized currency and OR tracking components

## Migration from Custom CSS

### Before
```tsx
<div className="form-group">
  <label className="form-label">Name <span className="required">*</span></label>
  <input className="form-control" />
  {error && <p className="form-error">{error}</p>}
</div>
```

### After
```tsx
<FormField label="Name" required error={error}>
  <Input name="name" />
</FormField>
```

See `QUICK_REFERENCE.md` for more migration examples.

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Examples

See migrated components in:
- `components/cashier/PostPaymentForm.tsx` - Form example
- `components/cashier/PaymentsHistoryTable.tsx` - Table example

## Contributing

When adding new components:

1. Follow existing patterns (see `/components/ui/button.tsx`)
2. Use CSS variables for colors (not hardcoded values)
3. Add TypeScript types
4. Support light/dark mode
5. Test accessibility (keyboard nav, screen readers)
6. Update documentation

## License

Internal SRAMS project - not for public distribution.
