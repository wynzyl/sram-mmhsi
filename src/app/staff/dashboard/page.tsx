import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

export default async function StaffDashboardPage() {
  const session = await requireSession();

  if (session.role !== "registrar") {
    redirect(staffHomePathForRole(session.role as Role));
  }

  return (
    <PageContainer>
      <PageHeader
        title="Registrar Dashboard"
        description="Shortcuts for registration, verification, enrollments, and the student master list."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/staff/register" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Register Student</CardTitle>
              <CardDescription>New, transferee, or returning (old) student entry points.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/registrations" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Verify Records</CardTitle>
              <CardDescription>Review the registrations pipeline and applicant rows.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/enrollments" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Enrollment</CardTitle>
              <CardDescription>Track enrollments and status across the active school year.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/students" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Master List</CardTitle>
              <CardDescription>Search enrolled students (one row per active enrollment).</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/enrollments/cancelled" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Cancelled Enrollments</CardTitle>
              <CardDescription>View enrollments that have been cancelled.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
