import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalStudentProfilePage } from "@/app/page-templates/students/student-profile-page";
import { getStudentByRef, resolveStudentRef } from "@/features/students/students.queries";

interface PageProps {
  params: Promise<{ studentRef: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { studentRef } = await params;
  const student = await getStudentByRef(studentRef);
  if (!student) return { title: "Student Not Found" };
  return { title: `${student.lastName}, ${student.firstName} — ${student.referenceNumber}` };
}

export default async function StaffStudentProfilePage({ params }: PageProps) {
  const { studentRef } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "students:read")) {
    redirect(staffHomePathForRole(session.role as Role));
  }

  const studentId = await resolveStudentRef(studentRef);
  if (!studentId) {
    notFound();
  }

  return (
    <InternalStudentProfilePage studentId={studentId} backHref="/staff/registrations" />
  );
}
