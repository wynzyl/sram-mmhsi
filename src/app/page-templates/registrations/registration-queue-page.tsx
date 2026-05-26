import Link from "next/link";
import { db } from "@/lib/db";
import { registrations, students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { and, eq, desc, ne, notExists, sql, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import RegistrationsTable from "@/features/registrations/components/RegistrationsTable";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { parseUuidSearchParam } from "@/lib/utils/query-params";

const PAGE_SIZE = 20;

type PathPrefix = "/staff";
type StudentBasePath = "/staff/students";

function registrationsListHref(prefix: PathPrefix, opts: { schoolYearId?: string; page?: number }) {
  const p = new URLSearchParams();
  if (opts.schoolYearId) p.set("schoolYearId", opts.schoolYearId);
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `${prefix}/registrations?${s}` : `${prefix}/registrations`;
}

/** Generate page numbers with ellipsis markers for pagination. */
function paginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive =
  "border-primary bg-primary/10 text-primary font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

function RegistrationsPagination({
  pathPrefix,
  currentPage,
  totalPages,
  totalCount,
  schoolYearId,
}: {
  pathPrefix: PathPrefix;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  schoolYearId?: string;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalCount);

  const hrefForPage = (page: number) =>
    registrationsListHref(pathPrefix, {
      schoolYearId,
      page: page > 1 ? page : undefined,
    });

  const pages = paginationPages(currentPage, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Registration list pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{" "}
        registration{totalCount !== 1 ? "s" : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {currentPage <= 1 ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
            ← Previous
          </span>
        ) : (
          <Link href={hrefForPage(currentPage - 1)} className={btnBase}>
            ← Previous
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {pages.map((item, i) =>
            item === "ellipsis" ? (
              <span
                key={`e-${i}`}
                className="inline-flex min-w-9 items-center justify-center text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                className={`${btnBase} min-w-9 px-0 ${item === currentPage ? btnActive : ""}`}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </Link>
            )
          )}
        </div>

        {currentPage >= totalPages ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
            Next →
          </span>
        ) : (
          <Link href={hrefForPage(currentPage + 1)} className={btnBase}>
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}

export async function RegistrationQueuePage(props: {
  searchParams: Promise<{ page?: string; schoolYearId?: string }>;
  pathPrefix: PathPrefix;
  deniedRedirect: string;
}) {
  const { searchParams, pathPrefix, deniedRedirect } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "registrations:read")) redirect(deniedRedirect);

  const { page = "1", schoolYearId: schoolYearIdRaw } = await searchParams;
  const schoolYearId = parseUuidSearchParam(schoolYearIdRaw);

  const parsed = parseInt(page, 10);
  const currentPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const activeSyRows = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);
  const activeSchoolYearId = activeSyRows[0]?.id ?? null;

  const notEnrolledInActiveYear =
    activeSchoolYearId != null
      ? notExists(
          db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.studentId, students.id),
                eq(enrollments.schoolYearId, activeSchoolYearId),
                ne(enrollments.status, "cancelled")
              )
            )
        )
      : undefined;

  const registrationFilters = [
    eq(registrations.status, "approved"),
    ...(schoolYearId != null ? [eq(registrations.schoolYearId, schoolYearId)] : []),
    ...(notEnrolledInActiveYear != null ? [notEnrolledInActiveYear] : []),
  ];

  const baseRowsQuery = db
    .select({
      id: registrations.id,
      createdAt: registrations.createdAt,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      studentType: registrations.studentType,
      intakeDocuments: registrations.intakeDocuments,
    })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .$dynamic();

  const filteredRowsBase = baseRowsQuery.where(and(...registrationFilters));

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .where(and(...registrationFilters));

  const [schoolYearOptions, rows, countResult] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),
    filteredRowsBase.orderBy(desc(registrations.createdAt)).limit(PAGE_SIZE).offset(offset),
    countQuery,
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const tableData = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    studentType: r.studentType,
    intakeDocuments: r.intakeDocuments,
    createdAt: r.createdAt,
  }));

  const studentBasePath = `${pathPrefix}/students` as StudentBasePath;

  return (
    <div className="page-container space-y-8">
      <SectionHeader
        title="Registrar queue"
        subtitle={
          <>
            <strong>Approved</strong> registrations only. Learners with a non-cancelled enrollment for
            the <strong>active</strong> school year are omitted. Filter by the school year stored on
            each registration.
          </>
        }
        size="md"
        accent
        actions={
          hasPermission(session.role, "students:create") ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href={`${studentBasePath}/new`}
                className="btn-primary h-auto px-4 py-2"
                id="new-registration-btn"
              >
                + New student
              </Link>
              <Link
                href={`${studentBasePath}/new?intent=transferee`}
                className="btn-secondary h-auto px-4 py-2 text-sm font-medium"
                id="new-registration-transferee-btn"
              >
                + Transferee
              </Link>
            </div>
          ) : undefined
        }
      />

      <form
        method="GET"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
      >
        <label htmlFor="registrations-school-year" className="text-sm text-muted-foreground">
          School year
        </label>
        <select
          id="registrations-school-year"
          name="schoolYearId"
          defaultValue={schoolYearId ?? ""}
          className="min-w-[12rem] rounded-md border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-2 text-[0.825rem] text-foreground outline-none"
        >
          <option value="">All school years</option>
          {schoolYearOptions.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        {schoolYearId != null && (
          <Link href={`${pathPrefix}/registrations`} className="btn-ghost text-sm">
            Clear filter
          </Link>
        )}
      </form>

      <RegistrationsTable
        registrations={tableData}
        studentBasePath={studentBasePath}
        emptyMessage={
          schoolYearId != null
            ? "No approved registrations for the selected school year that still need a current-year enrollment."
            : "No approved registrations pending current-year enrollment."
        }
      />

      <RegistrationsPagination
        pathPrefix={pathPrefix}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        schoolYearId={schoolYearId}
      />
    </div>
  );
}
