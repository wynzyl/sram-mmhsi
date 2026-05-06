import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import StudentRegistrationForm from "@/components/registrations/StudentRegistrationForm";

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
    <div className="page-container page-container-narrow space-y-8">
      <header className="space-y-2 border-b border-gray-100 pb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-warm-gray">New registration</p>
        <h1 className="font-display text-4xl font-black tracking-tight text-charcoal">
          {lockedRegistrationType === "transferee" ? "Register transferee" : "Register new student"}
        </h1>
        <p className="max-w-2xl text-warm-gray">
          Create the learner profile and an <strong className="text-charcoal">approved</strong> registration
          for the active school year. Open this page with{" "}
          <code className="rounded bg-(--color-surface-3) px-1.5 py-0.5 font-mono text-sm text-(--color-text)">
            ?intent=transferee
          </code>{" "}
          for transferee intake.
        </p>
      </header>

      <StudentRegistrationForm
        afterCreateStudentBasePath="/admin/students"
        currentSchoolYear={currentSchoolYear}
        gradeLevels={glRows}
        lockedRegistrationType={lockedRegistrationType}
      />
    </div>
  );
}
