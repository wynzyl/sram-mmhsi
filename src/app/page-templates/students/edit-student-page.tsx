import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, parentsGuardians, studentGuardianLinks, enrollments } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import EditStudentForm from "@/features/students/components/EditStudentForm";
import { StudentEditHero } from "@/features/students/components/StudentEditHero";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { isArchivedStatus, type StudentStatus } from "@/lib/constants/student-status";

/** Thin route pages must verify `students:update` before rendering. */
export async function InternalEditStudentPage(props: {
  studentId: string;
  studentsBasePrefix: "/staff/students";
}) {
  const { studentId: id, studentsBasePrefix } = props;
  const user = await getCurrentUser();

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
      photoUrl: true,

      isActive: true,
      isSpecialEducation: true,
      status: true,
    },
  });

  if (!student) notFound();

  // Block editing for archived students - redirect back to profile with a message
  if (isArchivedStatus(student.status as StudentStatus)) {
    redirect(`${studentsBasePrefix}/${student.referenceNumber}?archived=true`);
  }

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
    .where(
      and(
        eq(studentGuardianLinks.studentId, id),
        isNull(studentGuardianLinks.deletedAt),
      ),
    );

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

  const profileHref = `${studentsBasePrefix}/${student.referenceNumber}`;
  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
  const initials = [student.firstName?.[0], student.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  const canEditPhoto = user ? hasPermission(user.role, "students:update") : false;

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
        isSpecialEducation={student.isSpecialEducation}
        studentId={student.id}
        photoUrl={student.photoUrl}
        canEditPhoto={canEditPhoto}
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
