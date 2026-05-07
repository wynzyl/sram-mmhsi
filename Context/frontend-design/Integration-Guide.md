# Frontend Integration Guide: Academic Authority Design System

This document outlines the steps to integrate the **Academic Authority** design system into a Next.js project using Tailwind CSS.

## 1. Project Setup 

# Verify and skip if already installed. 

Ensure your Next.js project has Tailwind CSS installed.

```bash
npx create-next-app@latest my-school-system --typescript --tailwind --eslint
```

## 2. Design Tokens (tailwind.config.ts)

Configure your `tailwind.config.ts` to include the design system's color palette and typography.

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#c70000',
          container: '#ffdad4',
          'on-container': '#410001',
        },
        surface: {
          DEFAULT: '#fdf7ff',
          dim: '#ded8e0',
          bright: '#fdf7ff',
          container: {
            lowest: '#ffffff',
            low: '#f8f2fa',
            DEFAULT: '#f2ecf4',
            high: '#ece7ef',
            highest: '#e6e1e9',
          },
        },
        outline: {
          DEFAULT: '#857372',
          variant: '#d8c2bf',
        },
        'on-surface': {
          DEFAULT: '#1d1b1e',
          variant: '#49454e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xs': '4px', // ROUND_FOUR
      },
    },
  },
  plugins: [],
};
export default config;
```

## 3. Global Styles & Reusable Components (globals.css)

See the generated `globals.css` file for the CSS variables and component abstractions.

## 4. Migration Strategy: Replacing Hardcoded Styles

To ensure consistency, replace hardcoded hex codes and arbitrary spacing with design tokens:

- **Colors:** Replace `bg-[#fdf7ff]` with `bg-surface`.
- **Primary Actions:** Use the `.btn-primary` component class instead of individual utility strings.
- **Typography:** Use semantic classes like `.text-h1` or `.text-body-md` defined in your CSS.
- **Spacing:** Stick to Tailwind's default spacing scale (e.g., `p-4`, `m-6`) to maintain rhythm.

## 5. Reusable Function for Dynamic Classes

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes safely to avoid conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## 6. Editorial forms (SRAMS registrar theme)

Use this pattern on **new or migrated** screens that should match the registration wizard (Crimson display type, card surfaces, accent rails). Business logic stays in server actions; only layout and controls change.

### 6.1 Checklist

1. **Page header** — Use [`SectionHeader`](../components/ui/editorial/SectionHeader.tsx) (or equivalent: `font-display`, `text-charcoal`, optional accent rule).
2. **Surface** — Wrap the form in [`DataCard`](../components/ui/editorial/DataCard.tsx) / `DataCardBody` with `space-y-6` or `space-y-8` between sections.
3. **Sections** — Per block: accent rail `border-l-4 border-[var(--color-primary)] pl-6` and subheading `font-display text-2xl font-bold text-charcoal`.
4. **Labels** — `text-sm font-medium text-charcoal`; hints `text-warm-gray`; reference codes `font-mono`.
5. **Feedback** — [`FormStateAlert`](../components/forms/FormStateAlert.tsx) for server-action state; [`StatusIndicator`](../components/ui/editorial/StatusIndicator.tsx) for inline status when useful.
6. **Motion (optional)** — `animate-slide-in-soft` on section transitions; card lists `animate-reveal-stagger` with **fixed** stagger classes (`stagger-delay-1` … `stagger-delay-5`). Do **not** build stagger class names with template strings (Tailwind will not emit them).
7. **Primary CTA** — `bg-[var(--color-primary)]` or existing `btn-primary` until all pages are unified.

### 6.2 Tokens and primitives

| Resource | Location |
| -------- | -------- |
| CSS variables, editorial utilities, animations | [`src/app/globals.css`](../src/app/globals.css) |
| Shared input/select visual (TS) | [`lib/utils/editorial-styles.ts`](../lib/utils/editorial-styles.ts) — `editorialFieldClass()` |
| Same styling (raw HTML) | Classes `input-editorial` and `input-editorial-error` in `globals.css` |
| Layout chrome | [`components/ui/editorial/`](../components/ui/editorial/) |

### 6.3 Controlled fields from `components/forms`

For **controlled** fields aligned with [`FORM-MIGRATION-GUIDE.md`](../FORM-MIGRATION-GUIDE.md), pass **`variant="editorial"`** on `TextInputField`, `TextAreaField`, `SelectField`, and `SelectFieldGrouped` so labels and controls match the registration theme without duplicating class strings.

### 6.4 Legacy vs editorial

Older screens use `form-group` / `form-control`. Prefer **`variant="editorial"`** (or `editorialFieldClass` for one-off markup) when touching a form, so the codebase moves toward one visual language. See **FORM-MIGRATION-GUIDE.md** for the full migration list.
