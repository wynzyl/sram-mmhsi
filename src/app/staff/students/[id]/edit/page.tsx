import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalEditStudentPage } from "@/app/_internal/students/edit-student-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
    columns: { firstName: true, lastName: true },
  });
  if (!student) return { title: "Student Not Found" };
  return { title: `Edit ${student.lastName}, ${student.firstName}` };
}

export default async function StaffEditStudentPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "students:update")) {
    redirect(`/staff/students/${id}`);
  }

  return <InternalEditStudentPage studentId={id} studentsBasePrefix="/staff/students" />;
}
