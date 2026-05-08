# Registration Interface Redesign - Registrar Portal

## Context

The Registrar is a high-frequency user who processes student registrations daily during enrollment periods. The current interface is functional but generic, using standard tables and forms. This redesign will create a **distinctive, production-grade interface** that makes data processing efficient while being visually memorable.

## Design Vision: "Editorial Data Architecture"

**Aesthetic Direction:** Inspired by high-end editorial design and data journalism - think New York Times interactive features meets Notion's refined information hierarchy. Clean, structured, with unexpected typographic moments and spatial composition.

**Key Characteristics:**
- **Typography-driven hierarchy** using a distinctive font pairing (e.g., Crimson Pro for headings + IBM Plex Mono for data)
- **Asymmetric grid layouts** that break monotony while maintaining scanability
- **Subtle motion design** - staggered reveals, smooth state transitions
- **Rich data visualization** - status indicators, progress bars, document completion states
- **Refined color usage** - maintaining SRAMS deep red primary but with sophisticated application
- **Generous white space** with intentional density in data areas

**NOT:** Generic admin dashboard, material design clone, purple gradients, overused sans-serifs

## Implementation Plan

### Phase 1: Core Component Library (New Design Tokens)

**File:** `src/app/globals.css` (UPDATE)
- Add extended color palette: primary red + editorial grays + status colors (amber, emerald, slate)
- Add typography scale using Crimson Pro (display) + IBM Plex Mono (data/code)
- Add custom animations: `reveal-stagger`, `slide-in-soft`, `badge-pulse`
- Add shadow system for layered elevation

**File:** `components/ui/editorial/DataCard.tsx` (NEW)
- Elevated card with sophisticated borders and shadows
- Hover states with subtle elevation changes

**File:** `components/ui/editorial/StatusIndicator.tsx` (NEW)
- Animated status badges with subtle pulse
- Color-coded states (pending, complete, to-follow)

**File:** `components/ui/editorial/SectionHeader.tsx` (NEW)
- Large, bold section headers with accent rules
- Optional action buttons in header

### Phase 2: Document Progress & Guardian Components

**File:** `components/registrations/DocumentProgressRing.tsx` (NEW)
- Circular progress indicator for document completion (e.g., "3 of 5 complete")
- Animated ring with percentage display
- Color changes based on completion level

**File:** `components/registrations/GuardianCard.tsx` (NEW)
- Guardian information card with primary indicator
- Contact details with phone/email formatting
- Inline edit/remove actions

### Phase 3: Registrations List Page Redesign

**File:** `components/registrations/RegistrationsListView.tsx` (NEW)

**Layout Structure:**
```
┌─────────────────────────────────────────────────┐
│  REGISTRATIONS                    [Filter] [+]  │ ← Large display heading
│  127 pending enrollment                         │ ← Subtle body text
├─────────────────────────────────────────────────┤
│                                                 │
│  [Card: Student 1]  ┌─ Asymmetric              │
│  Name (large)       │  grid with               │
│  Ref | Grade | SY   │  staggered              │
│  ○○●○○ Documents    │  entry                   │
│  [View →]           │  animations              │
│                     │                           │
│  [Card: Student 2]  │                           │
│  ...                └─                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- Card-based layout (vs traditional table) for better visual hierarchy
- Staggered reveal animation on page load
- Inline document progress indicators (circular progress rings)
- Hover states with subtle elevation changes
- Quick-action buttons with smooth transitions
- Filter panel with refined form controls

### Phase 4: New Student Registration Form Redesign

**File:** `components/registrations/StudentRegistrationForm.tsx` (NEW)

**Layout Structure:**
```
┌─────────────────────────────────────────────────┐
│  New Student Registration                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━               │ ← Progress bar
│  Step 1 of 4: Student Information               │
├─────────────────────────────────────────────────┤
│                                                 │
│  PERSONAL DETAILS                               │ ← Section with accent border
│  ┌──────────────────┬───────────────────┐      │
│  │ First Name       │ Middle Name       │      │ ← Refined input fields
│  └──────────────────┴───────────────────┘      │
│  ...                                            │
│                                                 │
│  GUARDIANS                          [+ Add]     │
│  ┌──────────────────────────────────────────┐  │
│  │ ★ Primary Guardian                       │  │ ← Guardian card
│  │ Juan Dela Cruz                           │  │
│  │ Father • 0917-123-4567                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│                [Back]     [Continue →]          │
└─────────────────────────────────────────────────┘
```

**Features:**
- Multi-step wizard with visual progress bar
- Grouped sections with clear visual separation
- Guardian cards with inline editing
- Document upload with drag-drop zones
- Real-time validation with smooth error states
- Save as draft functionality

### Phase 5: Student Registration Detail View

**File:** `components/registrations/RegistrationDetailView.tsx` (NEW)

**Layout Structure:**
```
┌─────────────────────────────────────────────────┐
│  ← Back to Registrations                        │
├─────────────────────────────────────────────────┤
│  STU-2025-00127                    ● Pending    │ ← Reference + status
│                                                 │
│  DELA CRUZ, JUAN MIGUEL                         │ ← Student name (large)
│  Grade 7 • SY 2024-2025 • New Student          │ ← Metadata row
├─────────────────────────────────────────────────┤
│                                                 │
│  [Tab: Overview] [Documents] [History]          │
│                                                 │
│  STUDENT INFORMATION          GUARDIANS         │ ← Two-column asymmetric
│  ┌─────────────────┐         ┌──────────────┐  │
│  │ DOB: 01/15/2012 │         │ ★ Mother     │  │
│  │ LRN: 123456...  │         │   Maria DC   │  │
│  │ ...             │         │   0917-...   │  │
│  └─────────────────┘         └──────────────┘  │
│                                                 │
│  REQUIREMENTS                                   │
│  ●●●○○  3 of 5 complete                        │ ← Visual progress
│  ✓ Birth Certificate (PSA)                     │
│  ✓ Form 138                                    │
│  ✓ Good Moral Character                        │
│  ○ ESC Certificate (to follow)                 │
│  ○ Qualified Voucher (n/a)                     │
│                                                 │
│                    [Process Enrollment →]       │
└─────────────────────────────────────────────────┘
```

**Features:**
- Tabbed interface for different data views
- Visual document completion tracker
- Guardian contact cards
- Action buttons contextual to status
- Timeline/history view with audit trail

### Phase 6: Animations & Micro-interactions

**Animations to implement:**
1. **Page transitions:** Fade + subtle slide (150ms ease-out)
2. **Card entry:** Staggered reveal with 50ms delays
3. **Status changes:** Badge color transition + pulse effect
4. **Form validation:** Shake animation for errors, checkmark for success
5. **Hover states:** Elevation change (2px translate + shadow)
6. **Document upload:** Progress ring animation

**Implementation:** Pure CSS animations for HTML, Framer Motion for React components

## File Structure

```
components/
├── registrations/
│   ├── RegistrationsListView.tsx      ← List/queue page (NEW)
│   ├── StudentRegistrationForm.tsx    ← New student form (NEW)
│   ├── RegistrationDetailView.tsx     ← Detail view (NEW)
│   ├── DocumentProgressRing.tsx       ← Document completion indicator (NEW)
│   ├── GuardianCard.tsx               ← Guardian info card (NEW)
│   └── RegistrationsTable.tsx         ← (EXISTING - keep for reference)
└── ui/
    └── editorial/
        ├── DataCard.tsx               ← Elevated card component (NEW)
        ├── StatusIndicator.tsx        ← Animated status badges (NEW)
        └── SectionHeader.tsx          ← Large section headers (NEW)

src/app/
└── globals.css                        ← Update with new design tokens
```

## Integration with Existing Codebase

**Approach:** Build new components alongside existing ones, then swap at route level.

**No breaking changes:**
- Keep existing data queries/actions
- Reuse validators from `lib/validators/student.ts`
- Maintain same form submission flow
- Server actions remain unchanged

**Integration points:**
- Current: `/staff/registrations/page.tsx` uses `<RegistrationsTable>`
- Updated: `/staff/registrations/page.tsx` uses `<RegistrationsListView>`
- Current: `/staff/students/new/page.tsx` uses `<StudentForm>`
- Updated: `/staff/students/new/page.tsx` uses `<StudentRegistrationForm>`

## Typography Choices

**Display:** Crimson Pro (900 weight for headings, 600 for subheads)
- Distinctive serif for editorial feel
- NOT overused in web apps
- Professional academic tone

**Body:** IBM Plex Sans (400/500 for text)
- Clean, readable for forms
- Pairs well with Crimson Pro

**Data/Code:** IBM Plex Mono (reference numbers, status codes)
- Monospace for structured data
- Creates visual rhythm

**Load via Google Fonts:**
```html
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@600;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

## Color Palette Extension

**Existing SRAMS colors:**
- Primary: `#c70000` (deep red)
- Surface: `#fdf7ff`
- On-surface: `#1d1b1e`

**New editorial colors:**
- Charcoal: `#2d2d2d` (headings)
- Warm gray: `#6b6b6b` (secondary text)
- Light gray: `#f4f4f4` (card backgrounds)
- Accent amber: `#f59e0b` (warnings, pending states)
- Accent emerald: `#10b981` (success, complete states)
- Accent slate: `#64748b` (neutral states)

**Usage:**
- Primary red: CTAs, active states, critical actions
- Charcoal: Display headings
- Warm gray: Body text, metadata
- Light gray: Card surfaces, subtle backgrounds
- Amber: Document pending, warnings
- Emerald: Document complete, success states
- Slate: Inactive, disabled states

## Verification & Testing

1. **Visual QA:**
   - Check typography rendering in Chrome/Firefox/Safari
   - Verify animations run smoothly (60fps)
   - Test responsive breakpoints (desktop → tablet → mobile)
   - Validate color contrast for accessibility (WCAG AA)

2. **Functional Testing:**
   - Submit new student form → verify data saves correctly
   - Filter registrations by school year → verify query updates
   - Click document completion → verify state persists
   - Test guardian add/remove → verify form state

3. **Performance:**
   - Lighthouse score > 90
   - Page load with 100 registrations < 2s
   - Animation frame rate 60fps

4. **Accessibility:**
   - Keyboard navigation works throughout
   - Screen reader announces status changes
   - Focus states visible and logical
   - Form errors announced clearly

## Success Criteria

- Registrar can process students 20% faster due to improved information hierarchy
- Interface feels distinctive and memorable (not generic admin panel)
- No regressions in existing functionality
- Design system is documented and reusable for other SRAMS modules

## Timeline Estimate

**NOT PROVIDED** - Per project guidelines, no time estimates.

## Critical Files to Modify/Create

**New files:**
- `components/ui/editorial/DataCard.tsx`
- `components/ui/editorial/StatusIndicator.tsx`
- `components/ui/editorial/SectionHeader.tsx`
- `components/registrations/RegistrationsListView.tsx`
- `components/registrations/StudentRegistrationForm.tsx`
- `components/registrations/RegistrationDetailView.tsx`
- `components/registrations/DocumentProgressRing.tsx`
- `components/registrations/GuardianCard.tsx`

**Modified files:**
- `src/app/globals.css` (add extended design tokens)
- `src/app/staff/registrations/page.tsx` (swap RegistrationsTable → RegistrationsListView)
- `src/app/staff/students/new/page.tsx` (swap StudentForm → StudentRegistrationForm)

**Unchanged:**
- All server actions (`actions/students.ts`)
- All validators (`lib/validators/student.ts`)
- All queries (`lib/queries/*`)
- Database schema
- Existing `components/registrations/RegistrationsTable.tsx` (keep for backward compatibility)
