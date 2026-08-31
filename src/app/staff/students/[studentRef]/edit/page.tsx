import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalEditStudentPage } from "@/app/page-templates/students/edit-student-page";
import { getStudentByRef, resolveStudentRef } from "@/features/students/students.queries";

interface PageProps {
  params: Promise<{ studentRef: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { studentRef } = await params;
  const student = await getStudentByRef(studentRef);
  if (!student) return { title: "Student Not Found" };
  return { title: `Edit ${student.lastName}, ${student.firstName}` };
}

export default async function StaffEditStudentPage({ params }: PageProps) {
  const { studentRef } = await params;
  const session = await requireSession();

  const studentId = await resolveStudentRef(studentRef);
  if (!studentId) {
    notFound();
  }

  if (!hasPermission(session.role, "students:update")) {
    redirect(`/staff/students/${studentRef}`);
  }

  return <InternalEditStudentPage studentId={studentId} studentsBasePrefix="/staff/students" />;
}
