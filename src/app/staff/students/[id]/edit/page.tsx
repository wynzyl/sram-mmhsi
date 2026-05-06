import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, parentsGuardians, studentGuardianLinks, enrollments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditStudentForm from "@/components/students/EditStudentForm";
import { StudentEditHero } from "@/components/students/StudentEditHero";

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

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
    columns: {
      id: true,
      referenceNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      dateOfBirth: true,
      gender: true,
      address: true,

      lrn: true,
      mobileNumber: true,
      email: true,
      nationality: true,
      bloodType: true,
      religion: true,
      previousSchool: true,
      submittedDocumentsNotes: true,

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

  const hasEnrolledEnrollment = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.studentId, id), eq(enrollments.status, "enrolled")),
    columns: { id: true },
  });

  const profileHref = `/staff/students/${id}`;
  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
  const initials = [student.firstName?.[0], student.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <div className="page-container space-y-8">
      <StudentEditHero
        backHref={profileHref}
        backLabel="Back to profile"
        viewProfileHref={profileHref}
        fullName={fullName}
        initials={initials}
        referenceNumber={student.referenceNumber}
        isActive={student.isActive}
      />

      <EditStudentForm
        student={student}
        initialGuardians={initialGuardians}
        isActiveLocked={Boolean(hasEnrolledEnrollment)}
        afterSaveRedirect={profileHref}
        cancelHref={profileHref}
      />
    </div>
  );
}
