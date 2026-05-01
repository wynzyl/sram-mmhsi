import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, parentsGuardians, studentGuardianLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditStudentForm from "@/components/students/EditStudentForm";

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

export default async function EditStudentPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  
  if (!hasPermission(session.role, "students:update")) {
    redirect(`/admin/students/${id}`);
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
    columns: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      dateOfBirth: true,
      gender: true,
      address: true,

      // NEW FIELDS:
      lrn: true,
      mobileNumber: true,
      email: true,
      nationality: true,
      bloodType: true,
      religion: true,

      isActive: true,
    },
  });

  if (!student) notFound();

  const guardians = await db
    .select({
      isPrimary: studentGuardianLinks.isPrimary,
      firstName: parentsGuardians.firstName,
      middleName: parentsGuardians.middleName,
      lastName: parentsGuardians.lastName,
      relationship: parentsGuardians.relationship,
      address: parentsGuardians.address,
      occupation: parentsGuardians.occupation,
      contactNumber: parentsGuardians.contactNumber,
      email: parentsGuardians.email,
    })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(eq(studentGuardianLinks.studentId, id));

  // Map to GuardianInput for the form
  const initialGuardians = guardians.map((g) => ({
    firstName: g.firstName,
    middleName: g.middleName || "",
    lastName: g.lastName,
    relationship: g.relationship,
    address: g.address,
    occupation: g.occupation || "",
    contactNumber: g.contactNumber,
    email: g.email,
    isPrimary: g.isPrimary ?? false,
  }));

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Student</h1>
          <p className="page-subtitle">
            Update personal information and guardian details.
          </p>
        </div>
      </div>

      <EditStudentForm
        student={student}
        initialGuardians={initialGuardians}
      />
    </div>
  );
}
