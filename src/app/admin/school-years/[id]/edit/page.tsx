import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditSchoolYearForm from "@/components/school-years/EditSchoolYearForm";

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

export default async function EditSchoolYearPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/admin/dashboard");

  // Fetch school year
  const schoolYear = await db.query.schoolYears.findFirst({
    where: and(eq(schoolYears.id, id), isNull(schoolYears.deletedAt)),
    columns: {
      id: true,
      label: true,
      startDate: true,
      endDate: true,
      isActive: true,
    },
  });

  if (!schoolYear) notFound();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit School Year</h1>
          <p className="page-subtitle">{schoolYear.label}</p>
        </div>
        <Link href="/admin/school-years" className="btn-ghost">
          ← Back to School Years
        </Link>
      </div>

      <EditSchoolYearForm schoolYear={schoolYear} />
    </div>
  );
}
