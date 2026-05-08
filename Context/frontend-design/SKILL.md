---
@Integration-Guide.md
@@Reference

name: Academic Authority
colors:
  surface: '#fdf7ff'
  surface-dim: '#ded8e0'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2fa'
  surface-container: '#f2ecf4'
  surface-container-high: '#ece6ee'
  surface-container-highest: '#e6e0e9'
  on-surface: '#1d1b20'
  on-surface-variant: '#494551'
  inverse-surface: '#322f35'
  inverse-on-surface: '#f5eff7'
  outline: '#7a7582'
  outline-variant: '#cbc4d2'
  surface-tint: '#6750a4'
  primary: '#4f378a'
  on-primary: '#ffffff'
  primary-container: '#6750a4'
  on-primary-container: '#e0d2ff'
  inverse-primary: '#cfbcff'
  secondary: '#63597c'
  on-secondary: '#ffffff'
  secondary-container: '#e1d4fd'
  on-secondary-container: '#645a7d'
  tertiary: '#765b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c9a74d'
  on-tertiary-container: '#503d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#cfbcff'
  on-primary-fixed: '#22005d'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffdf93'
  tertiary-fixed-dim: '#e7c365'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#fdf7ff'
  on-background: '#1d1b20'
  surface-variant: '#e6e0e9'
typography:
  h1:
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  mono-data:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The brand personality is authoritative, institutional, and high-performance. This design system bridges the gap between traditional academic prestige and modern digital efficiency. It aims to evoke a sense of trust and precision, positioning the software as the central nervous system for school administration.

The visual style is **Corporate / Modern** with a lean toward **Minimalism**. It utilizes structured grids, ample whitespace to reduce cognitive load, and high-fidelity detailing to ensure clarity in complex data environments. The aesthetic avoids unnecessary flourishes, focusing instead on utilitarian elegance and rapid information retrieval.

## Colors

The palette is anchored by a deep institutional red (#960000), used for primary branding and navigation anchors to command respect and indicate hierarchy. Brighter reds (#e10000, #ff0000) are reserved for critical actions, alerts, and highlighting specific data points within the dashboard.

In **Light Mode**, the system uses high-contrast grayscale for text to ensure readability of student records and financial data. In **Dark Mode**, the background shifts to a deep charcoal to maintain the authoritative feel while reducing eye strain during late-night administrative sessions. Secondary status colors (green for passing/active, amber for pending/probation) are tuned for high legibility against both themes.

## Typography

**Inter** is the sole typeface for this design system, chosen for its exceptional legibility in data-dense interfaces. Headlines utilize tight tracking and heavier weights to establish clear section hierarchy. Body text is optimized for long-form reading, such as student reports or policy documents.

A specialized `mono-data` label style is used for IDs, grades, and numerical figures within tables to ensure character alignment and rapid scanning. Uppercase labels are employed for metadata tags and secondary navigation categories to distinguish them from primary interactive text.

## Layout & Spacing

This design system employs a **12-column fluid grid** system to maximize screen real estate for large datasets. A 4px baseline grid governs all vertical rhythms, ensuring that form inputs and table rows remain perfectly aligned.

Margins and gutters are generous (24px to 32px) to prevent the "cluttered" feel common in legacy school management software. This whitespace acts as a structural element, guiding the administrator’s eye toward primary metrics and action buttons.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Low-Contrast Outlines**. Instead of heavy shadows, this design system uses subtle 1px borders (#e5e5e5 in Light, #333333 in Dark) to define surface boundaries.

- **Level 0 (Canvas):** The base background layer.
- **Level 1 (Surface):** White/Dark Gray cards for primary content, using a very soft, high-diffusion shadow (4px blur, 2% opacity) to provide a gentle lift.
- **Level 2 (Popovers):** Modals and dropdowns use a more pronounced shadow and a distinct border to separate them from the work surface.
- **Active State:** Focused elements are highlighted with a 2px primary red (#960000) ring, emphasizing the authoritative focal point.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding provides a professional, modern feel without sacrificing the serious, institutional "box" structure required for data-heavy layouts. 

Buttons and input fields share this consistent 4px radius. Status badges and metric widgets may utilize a more rounded `rounded-lg` (8px) or `rounded-xl` (12px) style to differentiate them from functional inputs, making them appear as distinct "objects" on the page.

## Components

### Data Tables
Tables are the core of this system. They feature fixed headers, zebra-striping in light gray for readability, and condensed vertical padding to show more rows. Interaction occurs via hover-states that highlight the entire row in a subtle tint of the primary color.

### Multi-Step Forms
Forms utilize a left-hand vertical progress indicator to guide users through complex administrative tasks (e.g., student enrollment). Inputs are "outlined" style with high-contrast labels positioned above the field.

### Metric Widgets
Dashboard widgets use a bold typography approach for high-level numbers (e.g., "Total Attendance"). They include a 2px bottom border in primary red to anchor the data visually.

### Status Badges
Badges use a "subtle fill" approach: a light background color with high-contrast text and a small dot icon to indicate status (e.g., Active, Suspended, Graduated).

### Buttons
Primary buttons are solid #960000 with white text. Secondary buttons use an outlined style with the same red for the border and text. All buttons have a minimum height of 40px to ensure a confident "hit area."