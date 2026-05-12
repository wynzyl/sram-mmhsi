# Fee Template System Quick Reference

## Architecture Overview

```
┌─────────────────────┐
│  fee_item_types     │  Master fee definitions (13 predefined)
│  (tuition, fees,    │  e.g., TUITION, MISC, SIBLING_DISC
│   materials, etc.)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  fee_templates      │  Reusable fee structures per assessment band
│  (per band)         │  e.g., "Standard Casa Fees 2024+"
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ fee_template_items  │  Links fee types → default amounts
│ (items in template) │  e.g., TUITION → ₱45,000
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ school_year_fee_schedules   │  Active schedule per (SY, band)
│ (SY + band → template)      │  effective_date, expiry_date
└──────────┬────────────────────┘
           │
           ├─────────────────────────────┐
           ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐
│ fee_schedule_       │     │  assessments        │
│ overrides           │     │  ↓                  │
│ (year-specific      │     │  assessment_items   │
│  adjustments)       │     │  (snapshot)         │
└─────────────────────┘     └─────────────────────┘
```

## Key Concepts

### 1. Fee Item Types (Master Definitions)
Centralized list of all possible fee types. **Never duplicated.**

| Code | Name | Category | Is Discount |
|------|------|----------|-------------|
| TUITION | Tuition Fee | tuition | false |
| MISC | Miscellaneous Fees | fees | false |
| SIBLING_DISC | Sibling Discount | discount | true |

**Benefits:**
- Consistent naming (no typos)
- Easy reporting (GROUP BY fee_item_types.name)
- Predefined categories for financial reports

### 2. Fee Templates (Reusable Structures)
One template per assessment band, reused across years.

**Example: "Standard Casa Fees"**
- Band: casa
- Items: TUITION (₱45,000), MISC (₱5,000), ID (₱1,000)
- Can be assigned to 2024-2025, 2025-2026, etc.

**Benefits:**
- 80% reduction in fee schedule records
- Create once, use forever
- Easy to clone for variations

### 3. School Year Fee Schedules (Assignments)
Links a template to a school year + band.

**Example:**
- School Year: 2025-2026
- Band: casa
- Template: "Standard Casa Fees"
- Effective Date: 2025-06-01
- Active: true

**Only one active schedule per (school year, band).**

### 4. Fee Schedule Overrides (Year-Specific Adjustments)
Override amounts for specific year without duplicating entire template.

**Example:**
- Schedule: 2025-2026 Casa
- Item: TUITION (template default: ₱45,000)
- Override Amount: ₱48,000
- Reason: "2025 tuition increase"

**Benefits:**
- No need to create new template for small changes
- Track reasons for adjustments
- Easy to see what changed year-to-year

### 5. Assessment Items (Historical Snapshot)
When assessment is created, items are **snapshotted** (immutable).

**Columns:**
- `feeTemplateItemId` - Audit trail (which template item was used)
- `feeItemTypeId` - Reporting (GROUP BY for analytics)
- `description` - Snapshot from fee_item_types.name
- `amount` - Resolved amount (includes overrides)
- `isDiscount` - Snapshot from fee_item_types.isDiscount

## Common Workflows

### Create New Fee Template

```ts
// 1. Create template
await createFeeTemplateAction(formData); // name, band, description

// 2. Add items
await addFeeTemplateItemAction(formData); // feeItemTypeId, defaultAmount, order
await addFeeTemplateItemAction(formData);
await addFeeTemplateItemAction(formData);
```

### Assign Template to School Year

```ts
// 1. Select template (by band)
const templates = await getActiveFeeTemplatesByBand("casa");

// 2. Assign to school year
await assignTemplateToSchoolYearAction(formData);
// schoolYearId, assessmentBand, feeTemplateId, effectiveDate
```

### Add Year-Specific Override

```ts
// 1. Find schedule
const schedule = await getFeeScheduleById(scheduleId);

// 2. Create override
await createFeeOverrideAction(formData);
// scheduleId, feeTemplateItemId, overrideAmount, reason
```

### Create Assessment (Automatic)

```ts
// Resolution happens automatically
const resolution = await resolveFeeScheduleForAssessment(db, {
  schoolYearId,
  assessmentBand,
});

// Items already include overrides
resolution.items.forEach(item => {
  // item.amount = override ?? templateItem.defaultAmount
  // item.description = feeItemType.name
  // item.isDiscount = feeItemType.isDiscount
});

// Insert assessment items (snapshot)
await db.insert(assessmentItems).values(
  resolution.items.map(item => ({
    assessmentId,
    feeTemplateItemId: item.feeTemplateItemId,
    feeItemTypeId: item.feeItemTypeId,
    description: item.description,
    amount: item.amount,
    isDiscount: item.isDiscount,
  }))
);
```

## Database Queries

### Get All Templates

```sql
SELECT
  ft.name,
  ft.assessment_band,
  fti.default_amount,
  fit.name as fee_type,
  fit.is_discount
FROM fee_templates ft
JOIN fee_template_items fti ON ft.id = fti.fee_template_id
JOIN fee_item_types fit ON fti.fee_item_type_id = fit.id
WHERE ft.is_active = true
ORDER BY ft.assessment_band, fti.order;
```

### Get Active Schedule for School Year

```sql
SELECT
  syfs.id,
  ft.name as template_name,
  fti.default_amount,
  fit.name as fee_type,
  fso.override_amount,
  fso.reason as override_reason,
  COALESCE(fso.override_amount, fti.default_amount) as resolved_amount
FROM school_year_fee_schedules syfs
JOIN fee_templates ft ON syfs.fee_template_id = ft.id
JOIN fee_template_items fti ON ft.id = fti.fee_template_id
JOIN fee_item_types fit ON fti.fee_item_type_id = fit.id
LEFT JOIN fee_schedule_overrides fso
  ON syfs.id = fso.schedule_id
  AND fti.id = fso.fee_template_item_id
WHERE syfs.school_year_id = $1
  AND syfs.assessment_band = $2
  AND syfs.is_active = true
ORDER BY fti.order;
```

### Report Total Revenue by Fee Type

```sql
SELECT
  fit.name as fee_type,
  fit.category,
  SUM(ai.amount::numeric) as total_revenue,
  COUNT(DISTINCT ai.assessment_id) as assessment_count
FROM assessment_items ai
JOIN fee_item_types fit ON ai.fee_item_type_id = fit.id
JOIN assessments a ON ai.assessment_id = a.id
WHERE a.school_year_id = $1
  AND fit.is_discount = false
GROUP BY fit.id, fit.name, fit.category
ORDER BY total_revenue DESC;
```

## Migration Commands

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate

# Seed fee item types
npm run db:seed-fee-types

# Verify migration
psql -d srams_db -f scripts/verify-fee-template-migration.sql
```

## Files to Know

**Schema:**
- `lib/db/schema.ts` - Database tables

**Core Logic:**
- `lib/fee-schedule/resolve.ts` - Template resolution

**Actions:**
- `src/features/finance/fee-templates/fee-templates.actions.ts`
- `src/features/assessments/assessments.actions.ts`

**Queries:**
- `src/features/finance/fee-templates/fee-templates.queries.ts`
- `src/features/assessments/new-assessment-context.queries.ts`

**Schemas:**
- `src/features/finance/fee-templates/fee-templates.schema.ts`

**Scripts:**
- `scripts/seed-fee-item-types.ts`
- `scripts/verify-fee-template-migration.sql`

## Troubleshooting

### "No fee schedule found"
- Check if template is assigned to school year
- Check if schedule is active (`is_active = true`)
- Check effective/expiry dates

### "This fee type is already in this template"
- Each template can only have one instance of each fee type
- Use overrides for year-specific changes instead

### "An active fee schedule already exists"
- Only one active schedule allowed per (school year, band)
- Deactivate old schedule before creating new one

### Assessment items showing NULL for feeTemplateItemId
- Migration not run or incomplete
- Run verification queries to check data integrity
