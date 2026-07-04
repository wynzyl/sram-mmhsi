import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import StudentRegistrationForm from "@/features/registrations/components/StudentRegistrationForm";

export async function InternalNewStudentRegistrationPage(props: {
  searchParams: Promise<{ intent?: string }>;
  deniedRedirect: string;
  afterCreateStudentBasePath: "/staff/students";
}) {
  const { searchParams, deniedRedirect, afterCreateStudentBasePath } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) redirect(deniedRedirect);

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

  const subtitle = (
    <>
      Create the learner profile and an <strong className="text-foreground">approved</strong>{" "}
      registration for the active school year. Grade, requirements, and enrollment type follow how you opened
      this page; use{" "}
      <code className="rounded bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-sm text-foreground">
        ?intent=transferee
      </code>{" "}
      for transferee intake.
    </>
  );

  return (
    <div className="page-container page-container-narrow space-y-8">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          New registration
        </p>
        <h1 className="font-display text-4xl font-black tracking-tight text-foreground">
          {lockedRegistrationType === "transferee" ? "Register transferee" : "Register new student"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{subtitle}</p>
      </header>

      <StudentRegistrationForm
        afterCreateStudentBasePath={afterCreateStudentBasePath}
        currentSchoolYear={currentSchoolYear}
        gradeLevels={glRows}
        lockedRegistrationType={lockedRegistrationType}
      />
    </div>
  );
}
