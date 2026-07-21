import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears, gradingPeriodSystems } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditSchoolYearForm from "@/features/school-years/components/EditSchoolYearForm";
import type { GradingSystemType } from "@/lib/constants/grading-systems";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const schoolYear = await db.query.schoolYears.findFirst({
    where: and(eq(schoolYears.id, id), isNull(schoolYears.deletedAt)),
    columns: { label: true },
  });
  if (!schoolYear) return { title: "School Year Not Found" };
  return { title: `Edit ${schoolYear.label}` };
}

export default async function EditStaffSchoolYearPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/staff/dashboard");

  const schoolYear = await db.query.schoolYears.findFirst({
    where: and(eq(schoolYears.id, id), isNull(schoolYears.deletedAt)),
    columns: {
      id: true,
      label: true,
      startDate: true,
      endDate: true,
      isActive: true,
      cashDiscountCutoffDate: true,
    },
  });

  if (!schoolYear) notFound();

  // Fetch grading system type separately (handles case where table doesn't exist yet)
  let gradingSystemType: GradingSystemType = "quarterly";
  try {
    const gradingSystem = await db.query.gradingPeriodSystems.findFirst({
      where: eq(gradingPeriodSystems.schoolYearId, id),
      columns: { systemType: true },
    });
    if (gradingSystem?.systemType) {
      gradingSystemType = gradingSystem.systemType as GradingSystemType;
    }
  } catch {
    // Table may not exist yet - migrations not applied
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit School Year</h1>
          <p className="page-subtitle">{schoolYear.label}</p>
        </div>
        <Link href="/staff/school-years" className="btn-ghost">
          ← Back to School Years
        </Link>
      </div>

      <EditSchoolYearForm
        schoolYear={schoolYear}
        gradingSystemType={gradingSystemType}
        redirectPath="/staff/school-years"
      />
    </div>
  );
}
