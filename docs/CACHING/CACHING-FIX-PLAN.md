Updated 5-23-2026

## CACHING RESTRUCTURING

For SRAMS, my straight recommendation:

Do not cache cashier/payment/ledger mutation-heavy pages aggressively. These need fresh data.
Cache stable lookup data: grade levels, fee schedules, fee items, roles, school years, sections.
Use tag-based revalidation for specific data, not broad page revalidation. Example: after updating a fee item, revalidate fees, not the whole /admin area.
Avoid revalidatePath() everywhere after every Server Action. That is the usual rookie mistake. It works, but it can make the system feel like it drank expired coffee.
Benchmark in production build, not dev mode:

Best pattern:

    // For stable lookup data
    unstable_cache(getFeeSchedules, ['fee-schedules'], {
    tags: ['fee-schedules'],
    revalidate: 3600,
    })

    // After changing fee schedules
    revalidateTag('fee-schedules')

Use revalidatePath() only when the whole page output truly depends on the changed data. Otherwise, prefer revalidateTag(). More precise invalidation = faster system.


For SRAMS, do not cache the core transaction data aggressively. Students, assessments, enrollments, discounts, and ledgers are operational data. They change often, so caching them like “static pages” will backfire.

Use this strategy:

1. Default rule
    Data	Strategy
    Student list/search	Fresh DB query or very short cache
    Student profile	Cache by student ID, invalidate on update
    Enrollment list	Fresh DB query
    Enrollment detail	Cache by enrollment ID, invalidate on status change
    Assessment list	Fresh DB query
    Assessment detail	Cache by assessment ID, invalidate on assessment/discount/payment changes
    Discounts	Fresh for active transactions; cache discount catalog if stable
    Ledger / balance	No stale cache for official balance
    Dashboard totals	Short cache, 30–60 seconds
    Fee schedules, grade levels, school years, sections	Long cache

    The key: cache reference data, not financial truth.

2. Do not cache these pages heavily

    These should be mostly dynamic/fresh:

    /students
    /enrollments
    /assessments
    /cashier
    /ledger
    /payments
    /discounts

    Why? These pages are used for active transactions. If the cashier posts payment and the balance still shows the old amount, that is not a performance issue anymore — that is an accounting problem wearing a clown hat.

3. Use tag-based invalidation, not broad path revalidation

    Next.js separates path invalidation and tag invalidation: revalidatePath() targets a page/layout, while revalidateTag() and updateTag() target cached data used across pages. For frequently changing SRAMS data, tags are more precise.

    Use tags like this:

    students
    student:{studentId}

    enrollments
    enrollment:{enrollmentId}
    student-enrollments:{studentId}

    assessments
    assessment:{assessmentId}
    student-assessments:{studentId}

    ledger:{studentId}
    student-balance:{studentId}

    dashboard-metrics

    Example after payment:

    'use server'

    import { updateTag, revalidateTag } from 'next/cache'

    export async function postPayment(studentId: string, assessmentId: string) {
    // 1. Save payment
    // 2. Insert ledger entry
    // 3. Update assessment balance/status

    updateTag(`student-balance:${studentId}`)
    updateTag(`ledger:${studentId}`)
    updateTag(`assessment:${assessmentId}`)

    revalidateTag('dashboard-metrics', 'max')
    }

    Use updateTag() when the user must immediately see their own changes. Next.js says updateTag() is designed for “read-your-own-writes” and makes the next request wait for fresh data instead of serving stale content.

    Use revalidateTag(tag, 'max') for less critical data like dashboard totals because it serves stale data while refreshing in the background.

4. Best SRAMS caching design
    A. Transaction pages: fresh

    Use fresh DB queries for:

    Cashier payment page
    Assessment editing page
    Enrollment status update page
    Discount application page
    Official student balance
    Ledger posting
    OR void / reversal

    These must be correct immediately.

    B. Detail pages: cache carefully

    Cache detail reads, but invalidate them after every mutation.

    Example:

    getStudentById(studentId)        // cache tag: student:{id}
    getAssessmentById(assessmentId)  // cache tag: assessment:{id}
    getLedgerByStudent(studentId)    // cache tag: ledger:{id}

    After update:

    updateTag(`student:${studentId}`)
    updateTag(`assessment:${assessmentId}`)
    updateTag(`ledger:${studentId}`)
    C. Lists: avoid heavy cache

    For large list pages, prefer:

    pagination
    search debounce
    indexed DB columns
    select only needed fields
    TanStack Query staleTime
    loading skeleton

    Do not solve slow student tables with caching first. Fix query shape first.

    Bad:

    SELECT * FROM students;

    Better:

    SELECT id, student_no, full_name, grade_level, enrollment_status
    FROM students
    ORDER BY created_at DESC
    LIMIT 20 OFFSET 0;

5. Recommended setup for SRAMS

    Use this policy:

    Official financial data = no stale cache
    Operational tables = fresh or short-lived cache
    Detail records = cache by ID + updateTag after mutation
    Dashboard cards = 30–60 seconds cache
    Reference data = long cache

6. When to use revalidatePath()

    Use it rarely.

    Good:

    revalidatePath(`/students/${studentId}`)

    Bad:

    revalidatePath('/admin')
    revalidatePath('/registrar')
    revalidatePath('/')

    Broad path revalidation can cause many pages to refresh. Next.js documents that layout invalidation affects nested layouts and pages below it, so using it carelessly can make the system feel slow.

    Final recommendation

    For SRAMS:

    Cache fee schedules, grade levels, school years, sections, roles.
    Do not aggressively cache cashier, ledger, payment, assessment, and enrollment workflows.
    Use updateTag() after mutations.
    Use revalidateTag('tag', 'max') for dashboard summaries.
    Use revalidatePath() only for specific pages.

    In short: SRAMS should be database-fast first, cache-smart second. Caching unstable school-finance data too much will create stale records, confused staff, and eventually someone asking why ₱5,000 disappeared. That is how systems earn enemies.