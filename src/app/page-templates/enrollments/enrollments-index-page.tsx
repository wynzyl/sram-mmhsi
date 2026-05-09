import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  sections,
  assessments,
} from "@/lib/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { EnrollmentsListView } from "@/features/enrollments";
import type {
  EnrollmentCardRow,
  EnrollmentStatus,
} from "@/features/enrollments";

const VALID_STATUSES = ["pending", "assessed", "enrolled", "cancelled", "all"] as const;

export async function EnrollmentsIndexPage(props: {
  searchParams: Promise<{ status?: string; sy?: string; page?: string }>;
  deniedRedirect: string;
}) {
  const { searchParams, deniedRedirect } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:read")) redirect(deniedRedirect);

  const { status = "all", page: pageParam } = await searchParams;
  const filterStatus = (
    (VALID_STATUSES as readonly string[]).includes(status) ? status : "all"
  ) as "all" | EnrollmentStatus;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const pageSize = 100;
  const offset = (page - 1) * pageSize;

  const canCreate = hasPermission(session.role, "enrollments:create");
  const canManage =
    hasPermission(session.role, "assessments:create") || canCreate;
  const canCancel = hasPermission(session.role, "enrollments:cancel");
  const canCancelWithBalance = hasPermission(session.role, "enrollments:cancel_with_balance");
  const canOverrideEnrolled = hasPermission(session.role, "enrollments:override_enroll");

  const statusFilter =
    filterStatus !== "all" ? eq(enrollments.status, filterStatus) : undefined;

  const [{ count: totalFilteredCountRaw }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(statusFilter);
  const totalFilteredCount = Number(totalFilteredCountRaw ?? 0);

  const rows = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      enrolledAt: enrollments.enrolledAt,
      cancelledAt: enrollments.cancelledAt,
      createdAt: enrollments.createdAt,
      studentType: enrollments.studentType,
      intakeDocuments: enrollments.intakeDocuments,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      section: sections.name,
      assessmentId: assessments.id,
      assessmentTotalAmount: assessments.totalAmount,
      assessmentTotalPaid: assessments.totalPaid,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .leftJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(statusFilter)
    .orderBy(desc(enrollments.createdAt))
    .offset(offset)
    .limit(pageSize);

  const hasMore = offset + rows.length < totalFilteredCount;

  const counts = await db
    .select({ status: enrollments.status, count: sql<number>`count(*)` })
    .from(enrollments)
    .groupBy(enrollments.status);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, Number(c.count)])) as Partial<
    Record<EnrollmentStatus, number>
  >;

  const cardRows: EnrollmentCardRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    studentId: r.studentId,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    section: r.section ?? null,
    studentType: r.studentType,
    enrolledAt: r.enrolledAt,
    createdAt: r.createdAt,
    assessmentId: r.assessmentId ?? null,
    assessmentTotalAmount:
      r.assessmentTotalAmount != null && r.assessmentTotalAmount !== ""
        ? Number(r.assessmentTotalAmount)
        : null,
    assessmentTotalPaid:
      r.assessmentTotalPaid != null && r.assessmentTotalPaid !== ""
        ? Number(r.assessmentTotalPaid)
        : null,
    intakeDocuments: r.intakeDocuments ?? null,
  }));

  const allSections = await db
    .select({ id: sections.id, name: sections.name })
    .from(sections);

  const activeSyRows = await db
    .select({ label: schoolYears.label })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);
  const schoolYearLabel = activeSyRows[0]?.label ?? null;

  return (
    <div className="page-container">
      <EnrollmentsListView
        enrollments={cardRows}
        sections={allSections}
        countMap={countMap}
        filterStatus={filterStatus}
        schoolYearLabel={schoolYearLabel}
        page={page}
        pageSize={pageSize}
        totalFilteredCount={totalFilteredCount}
        hasMore={hasMore}
        canCreate={canCreate}
        canManage={canManage}
        canCancel={canCancel}
        canCancelWithBalance={canCancelWithBalance}
        canOverrideEnrolled={canOverrideEnrolled}
      />
    </div>
  );
}
