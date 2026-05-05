import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { hasPermission } from "@/lib/rbac/permissions";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Register Student",
  description: "Choose how to register or enroll a learner.",
};

export default async function StaffRegisterHubPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create") && !hasPermission(session.role, "enrollments:create")) {
    redirect(staffHomePathForRole(session.role as Role));
  }

  return (
    <PageContainer>
      <PageHeader
        title="Register Student"
        description="Pick the path that matches the learner. Master data is created first for new and transferee applicants; returning learners are enrolled from the existing record."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {hasPermission(session.role, "students:create") && (
          <>
            <Link href="/staff/students/new" className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>New Student</CardTitle>
                  <CardDescription>Create a new master student record (no prior SRAMS enrollment).</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/staff/students/new?intent=transferee" className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>Transferee</CardTitle>
                  <CardDescription>
                    New master record from another school — capture previous school, then enroll as transferee.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </>
        )}

        {hasPermission(session.role, "enrollments:create") && (
          <Link href="/staff/enrollments/new" className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>Old Student</CardTitle>
                <CardDescription>
                  Returning learner: select an existing student with a prior SRAMS enrollment; enrollment type is set
                  automatically.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </PageContainer>
  );
}
