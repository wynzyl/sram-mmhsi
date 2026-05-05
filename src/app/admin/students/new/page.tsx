import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import StudentForm from "@/components/students/StudentForm";

export const metadata: Metadata = {
  title: "Register New Student",
};

interface PageProps {
  searchParams: Promise<{ intent?: string }>;
}

export default async function AdminNewStudentPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) redirect("/admin/students");

  const { intent } = await searchParams;
  const lockedRegistrationType = intent === "transferee" ? "transferee" : "new_student";

  const [activeSyRows, glRows] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
      .limit(1),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name, order: gradeLevels.order })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
  ]);

  const currentSchoolYear = activeSyRows[0] ?? null;

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lockedRegistrationType === "transferee" ? "Register Transferee" : "Register New Student"}
          </h1>
          <p className="page-subtitle">
            Create the learner profile and an <strong>approved</strong> registration for the active school year. Use{" "}
            <code className="reference-code">?intent=transferee</code> in the URL for transferee intake.
          </p>
        </div>
      </div>

      <StudentForm
        afterCreateStudentBasePath="/admin/students"
        currentSchoolYear={currentSchoolYear}
        gradeLevels={glRows}
        lockedRegistrationType={lockedRegistrationType}
      />
    </div>
  );
}
