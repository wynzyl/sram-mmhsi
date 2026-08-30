import { db } from "@/lib/db";
import { registrations, students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { and, eq, desc, ne, notExists, sql, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import RegistrationsTable from "@/features/registrations/components/RegistrationsTable";
import { parseUuidSearchParam } from "@/lib/utils/query-params";
import { TablePagination } from "@/components/ui/TablePagination";
import { RegistrationQueueToolbar } from "./RegistrationQueueToolbar";

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
    // Filter out archived students - only show active students
    eq(students.status, "active"),
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

  // Derive display labels for subtitle
  const selectedYearLabel = schoolYearId
    ? schoolYearOptions.find((y) => y.id === schoolYearId)?.label
    : null;
  const hasFilters = schoolYearId != null;

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
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Registration Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          {selectedYearLabel ?? "All School Years"} • {totalCount.toLocaleString()} Registration{totalCount !== 1 ? "s" : ""}{" "}
          {hasFilters ? "matching filter" : "pending enrollment"}
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="queue-heading"
      >
        {/* Card Header - Inline Controls */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Section Label + Count Badge */}
          <div className="flex items-center gap-3">
            <h2
              id="queue-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Approved Registrations
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {totalCount} Record{totalCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Right: All Controls - Inline Row */}
          <RegistrationQueueToolbar
            schoolYearOptions={schoolYearOptions}
            schoolYearId={schoolYearId}
            hasFilters={hasFilters}
            clearHref={`${pathPrefix}/registrations`}
            newStudentHref={`${studentBasePath}/new`}
            newTransfereeHref={`${studentBasePath}/new?intent=transferee`}
            canCreate={hasPermission(session.role, "students:create")}
          />
        </div>

        <RegistrationsTable
          registrations={tableData}
          studentBasePath={studentBasePath}
          emptyMessage={
            schoolYearId != null
              ? "No approved registrations for the selected school year that still need a current-year enrollment."
              : "No approved registrations pending current-year enrollment."
          }
        />

        {totalCount > 0 && (
          <div className="border-t border-border px-4 py-3">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalCount}
              pageSize={PAGE_SIZE}
              baseUrl={registrationsListHref(pathPrefix, { schoolYearId })}
              itemLabel="registrations"
            />
          </div>
        )}
      </section>

      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Confidential institutional data. Authorized access only.
      </p>
    </div>
  );
}
