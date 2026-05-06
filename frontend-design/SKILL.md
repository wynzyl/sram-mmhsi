# Frontend Integration Guide: Academic Authority Design System

This document outlines the steps to integrate the **Academic Authority** design system into a Next.js project using Tailwind CSS.

<!-- ## 1. Project Setup

Ensure your Next.js project has Tailwind CSS installed.

```bash
npx create-next-app@latest my-school-system --typescript --tailwind --eslint
``` -->

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
