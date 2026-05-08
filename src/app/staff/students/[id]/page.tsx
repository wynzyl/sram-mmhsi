import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalStudentProfilePage } from "@/app/_internal/students/student-profile-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
    columns: { firstName: true, lastName: true, referenceNumber: true },
  });
  if (!student) return { title: "Student Not Found" };
  return { title: `${student.lastName}, ${student.firstName} — ${student.referenceNumber}` };
}

export default async function StaffStudentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) {
    redirect(staffHomePathForRole(session.role as Role));
  }

  return (
    <InternalStudentProfilePage studentId={id} backHref="/staff/registrations" />
  );
}
