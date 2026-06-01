# General Payment Collection Report Implementation Plan

## Overview
Implement a Payment Collection Report at `/staff/reports/payment-collection` with date range filtering and PDF export using `@react-pdf/renderer`.

## Key Features

| Feature | Description |
|---------|-------------|
| **Date Range Filter** | Start/end date inputs with default last 30 days. All queries and PDF export respect date range. |
| **Additional Filters** | School year, payment method (cash/gcash/bank/check), payment status |
| **Summary Cards** | Total count, total amount, breakdown by payment method |
| **Data Table** | Paginated table with OR#, date, student, amount, method, cashier |
| **PDF Export** | Download filtered data as PDF with header, summary, and table |

## Dependencies

**Install:** `npm install @react-pdf/renderer`

## Files to Create

### 1. Query Layer
**File:** `src/features/reports/payment-collection-report.queries.ts`

```typescript
// Types
PaymentCollectionRow: id, orNumber, collectionDate, studentId, studentName,
  studentRef, gradeLevel, schoolYear, amount, paymentMethod, referenceNumber,
  status, kind, remarks, processedBy

PaymentCollectionSummary: totalCount, totalAmount, byMethod (cash, gcash,
  bank_transfer, check, other)

// Queries
getPaymentCollectionReport(params) - Paginated report with filters
getPaymentCollectionSummary(params) - Summary stats for cards
getAllPaymentCollectionData(params) - Full dataset for PDF export (no pagination)
```

**Query joins:**
- `payments` → `students` (studentId)
- `payments` → `assessments` (assessmentId) → `schoolYears`
- `assessments` → `enrollments` → `gradeLevels`
- `payments` → `users` (createdBy for cashier name)

**Filters supported:**
- `startDate`, `endDate` (required, default last 30 days)
- `schoolYearId` (optional)
- `paymentMethod` (optional: cash, gcash, bank_transfer, check, other)
- `paymentStatus` (optional: posted, reversed)
- `page`, `pageSize` (pagination)

### 2. PDF Document Template
**File:** `src/features/reports/components/PaymentCollectionPDF.tsx`

Uses `@react-pdf/renderer` components:
- `Document`, `Page`, `View`, `Text`, `StyleSheet`

Structure:
```
┌──────────────────────────────────────────────────────┐
│ SRAMS - Payment Collection Report                    │
│ Period: {startDate} - {endDate}                      │
│ Generated: {timestamp}                               │
├──────────────────────────────────────────────────────┤
│ SUMMARY                                              │
│ Total Payments: {count}    Total Amount: ₱{amount}   │
│ Cash: ₱{x}  GCash: ₱{y}  Bank: ₱{z}  Check: ₱{w}    │
├──────────────────────────────────────────────────────┤
│ OR #    │ Date    │ Student       │ Amount │ Method │
│─────────┼─────────┼───────────────┼────────┼────────│
│ AP-0001 │ 05/30   │ DELA CRUZ, J  │ ₱5,000 │ Cash   │
│ ...     │ ...     │ ...           │ ...    │ ...    │
├──────────────────────────────────────────────────────┤
│ Page {n} of {total}                                  │
└──────────────────────────────────────────────────────┘
```

### 3. PDF Download Button
**File:** `src/features/reports/components/ExportPaymentCollectionPDF.tsx`

Client component with:
- Button to trigger PDF generation
- Uses `@react-pdf/renderer`'s `pdf()` function + `blob()`
- Downloads file as `payment-collection-{startDate}-{endDate}.pdf`
- Loading state during generation

### 4. Filter Component
**File:** `src/features/reports/components/PaymentCollectionFilters.tsx`

Inputs:
- Start Date (date input)
- End Date (date input)
- School Year (select dropdown)
- Payment Method (select dropdown)
- Payment Status (select dropdown)
- Apply / Reset buttons

URL-driven state sync (same pattern as BfxReportFilters).

### 5. Table Component
**File:** `src/features/reports/components/PaymentCollectionTable.tsx`

Columns:
| Column | Description |
|--------|-------------|
| OR # | Badge with OR number |
| Date | Formatted collection date |
| Student | Name + reference code (link) |
| Grade Level | e.g., "Grade 7" |
| Amount | CurrencyDisplay (PHP) |
| Method | Badge (cash/gcash/etc.) |
| Reference # | For GCash/bank transfers |
| Processed By | Cashier name |
| Status | Badge (posted/reversed) |

Uses `DataTable` with client-side search and pagination.

### 6. Page Component
**File:** `src/app/staff/reports/payment-collection/page.tsx`

Structure:
1. `requireSession()` + permission check (`reports:view`)
2. Parse URL search params (dates, filters, page)
3. Default date range: last 30 days
4. Parallel fetch: `getPaymentCollectionReport()` + `getPaymentCollectionSummary()`
5. Render:
   - PageHeader with Export PDF button
   - Summary cards (Total Collections, Total Amount, By Method breakdown)
   - PaymentCollectionFilters
   - PaymentCollectionTable with pagination

### 7. PDF Data API Route
**File:** `src/app/staff/reports/payment-collection/pdf-data/route.ts`

Server route to fetch full (unpaginated) data for PDF export:
- Validates session + permissions
- Accepts same filter params as page
- Returns JSON with all rows + summary for PDF generation
- Client fetches this before generating PDF

### 8. Loading State
**File:** `src/app/staff/reports/payment-collection/loading.tsx`

Skeleton cards + skeleton table rows.

## Summary Cards Layout

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Total Payments  │ Total Collected │ Period          │
│ {count}         │ ₱{amount}       │ {start} - {end} │
└─────────────────┴─────────────────┴─────────────────┘

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Cash            │ GCash           │ Bank Transfer   │ Check           │
│ ₱{amount}       │ ₱{amount}       │ ₱{amount}       │ ₱{amount}       │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

## PDF Export Flow

```
User clicks "Export PDF"
       ↓
ExportPaymentCollectionPDF (client component)
       ↓
Fetch /staff/reports/payment-collection/pdf-data?startDate=...&endDate=...
       ↓
Server validates session + returns full dataset
       ↓
Generate PDF using @react-pdf/renderer pdf().toBlob()
       ↓
Trigger browser download
```

## Query Implementation Details

**Main report query (posted payments only):**
```typescript
const conditions = [
  eq(payments.status, "posted"),
  eq(payments.kind, "payment"),  // Exclude reversals from main list
  gte(payments.paymentDate, startDate),
  lte(payments.paymentDate, endDate),
  isNull(students.deletedAt),
];
// Add optional filters...
```

**Summary by method:**
```sql
SELECT
  COUNT(*) as total_count,
  SUM(amount) as total_amount,
  SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash_total,
  SUM(CASE WHEN payment_method = 'gcash' THEN amount ELSE 0 END) as gcash_total,
  -- etc.
FROM payments
WHERE status = 'posted' AND kind = 'payment' AND payment_date BETWEEN ? AND ?
```

## Implementation Order

1. **Install dependency**
   ```bash
   npm install @react-pdf/renderer
   ```

2. **Query layer** (`payment-collection-report.queries.ts`)
   - Define types
   - Implement `getPaymentCollectionReport()`
   - Implement `getPaymentCollectionSummary()`
   - Implement `getAllPaymentCollectionData()` for PDF

3. **Filter component** (`PaymentCollectionFilters.tsx`)
   - Copy BfxReportFilters pattern
   - Add payment method + status dropdowns

4. **Table component** (`PaymentCollectionTable.tsx`)
   - Define columns with proper formatters
   - Use DataTable wrapper

5. **PDF template** (`PaymentCollectionPDF.tsx`)
   - Define styles with StyleSheet.create()
   - Build Document structure with header, summary, table

6. **PDF data route** (`pdf-data/route.ts`)
   - Session validation
   - Return full dataset as JSON

7. **Export button** (`ExportPaymentCollectionPDF.tsx`)
   - Fetch data from route
   - Generate PDF blob
   - Trigger download

8. **Page component** (`page.tsx`)
   - Wire up data fetching
   - Add summary cards
   - Compose filters + table + export button

9. **Loading state** (`loading.tsx`)

10. **Update exports** in `src/features/reports/index.ts`

## Verification

1. **Navigate to** `/staff/reports/payment-collection`
2. **Check default view** shows last 30 days of posted payments
3. **Test date range** - change dates, verify data updates
4. **Test filters** - school year, payment method, status
5. **Verify summary cards** match filtered data
6. **Check pagination** with different page sizes
7. **Verify Reset** clears all filters to defaults
8. **Test PDF export**:
   - Click "Export PDF" button
   - Verify PDF downloads with correct filename
   - Open PDF and verify: header, summary section, table data matches filters
   - Check pagination in PDF for large datasets
9. **Test permissions** - non-authorized roles should redirect

## Files Modified/Created Summary

| Action | Path |
|--------|------|
| INSTALL | `@react-pdf/renderer` (npm install) |
| CREATE | `src/features/reports/payment-collection-report.queries.ts` |
| CREATE | `src/features/reports/components/PaymentCollectionFilters.tsx` |
| CREATE | `src/features/reports/components/PaymentCollectionTable.tsx` |
| CREATE | `src/features/reports/components/PaymentCollectionPDF.tsx` |
| CREATE | `src/features/reports/components/ExportPaymentCollectionPDF.tsx` |
| CREATE | `src/app/staff/reports/payment-collection/page.tsx` |
| CREATE | `src/app/staff/reports/payment-collection/pdf-data/route.ts` |
| CREATE | `src/app/staff/reports/payment-collection/loading.tsx` |
| UPDATE | `src/features/reports/index.ts` (add exports) |
