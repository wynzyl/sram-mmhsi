import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  enrollments,
  schoolYears,
  gradeLevels,
  sections,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";

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

export default async function StudentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) redirect("/admin/dashboard");

  // Fetch student with guardians and enrollment history
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

      // NEW FIELDS:
      lrn: true,
      mobileNumber: true,
      email: true,
      nationality: true,
      bloodType: true,
      religion: true,
      previousSchool: true,
      submittedDocumentsNotes: true,

      isActive: true,
      createdAt: true,
    },
  });

  if (!student) notFound();

  // Fetch guardians
  const guardianLinks = await db
    .select({
      id: parentsGuardians.id,
      isPrimary: studentGuardianLinks.isPrimary,
      firstName: parentsGuardians.firstName,
      middleName: parentsGuardians.middleName,
      lastName: parentsGuardians.lastName,
      relationship: parentsGuardians.relationship,
      address: parentsGuardians.address,
      contactNumber: parentsGuardians.contactNumber,
      email: parentsGuardians.email,
    })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(eq(studentGuardianLinks.studentId, id));

  const enrollmentRows = await db
    .select({
      id: enrollments.id,
      createdAt: enrollments.createdAt,
      enrolledAt: enrollments.enrolledAt,
      status: enrollments.status,
      studentType: enrollments.studentType,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(eq(enrollments.studentId, id))
    .orderBy(desc(enrollments.createdAt));

  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="page-container">
      {/* Back */}
      <Link href="/admin/students" className="back-link">
        ← Back to Students
      </Link>

      {/* Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {student.firstName[0]}
          {student.lastName[0]}
        </div>
        <div className="profile-meta">
          <h1 className="profile-name">{fullName}</h1>
          <p className="profile-ref">{student.referenceNumber}</p>
          <span className={`badge ${student.isActive ? "badge-success" : "badge-danger"}`}>
            {student.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="profile-actions">
          {hasPermission(session.role, "enrollments:create") && (
            <Link
              href={`/admin/enrollments/new?studentId=${id}`}
              className="btn-secondary"
              id="enroll-student-btn"
            >
              Enroll Student
            </Link>
          )}
          {hasPermission(session.role, "students:update") && (
            <Link
              href={`/admin/students/${id}/edit`}
              className="btn-secondary"
              id="edit-student-btn"
            >
              Edit Student
            </Link>
          )}
        </div>
      </div>

      <div className="profile-grid">
        {/* ─── Personal Information ─────────────────────────────── */}
        <section className="profile-card">
          <h2 className="profile-card-title">Personal Information</h2>
          <dl className="profile-dl">
            <div className="profile-dl-row">
              <dt>Date of Birth</dt>
              <dd>
                {student.dateOfBirth
                  ? new Date(student.dateOfBirth).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            <div className="profile-dl-row">
              <dt>Gender</dt>
              <dd className="text-capitalize">{student.gender ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Address</dt>
              <dd>{student.address ?? "—"}</dd>
            </div>

            {/* NEW FIELDS */}
            <div className="profile-dl-row">
              <dt>LRN</dt>
              <dd className="font-[family-name:var(--font-mono)] text-sm">
                {student.lrn ?? "—"}
              </dd>
            </div>
            <div className="profile-dl-row">
              <dt>Mobile Number</dt>
              <dd>{student.mobileNumber ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Email</dt>
              <dd>{student.email ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Nationality</dt>
              <dd>{student.nationality ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Blood Type</dt>
              <dd>
                {student.bloodType ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                    {student.bloodType}
                  </span>
                ) : "—"}
              </dd>
            </div>
            <div className="profile-dl-row">
              <dt>Religion</dt>
              <dd>{student.religion ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Previous school</dt>
              <dd>{student.previousSchool ?? "—"}</dd>
            </div>
            <div className="profile-dl-row">
              <dt>Documents (notes)</dt>
              <dd className="whitespace-pre-wrap">{student.submittedDocumentsNotes ?? "—"}</dd>
            </div>

            <div className="profile-dl-row">
              <dt>Registered On</dt>
              <dd>
                {new Date(student.createdAt).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </section>

        {/* ─── Guardians ────────────────────────────────────────── */}
        <section className="profile-card">
          <h2 className="profile-card-title">Parents / Guardians</h2>
          {guardianLinks.length === 0 ? (
            <p className="text-muted">No guardians on file.</p>
          ) : (
            <ul className="guardian-list-profile">
              {guardianLinks.map((g) => (
                <li key={g.id} className="guardian-item">
                  <div className="guardian-item-name">
                    {g.firstName} {g.middleName} {g.lastName}
                    {g.isPrimary && (
                      <span className="guardian-badge-primary">Primary</span>
                    )}
                  </div>
                  <dl className="profile-dl guardian-profile-dl mt-2">
                    <div className="profile-dl-row">
                      <dt>Relationship</dt>
                      <dd>{g.relationship}</dd>
                    </div>
                    <div className="profile-dl-row">
                      <dt>Address</dt>
                      <dd>{g.address?.trim() ? g.address : "—"}</dd>
                    </div>
                    <div className="profile-dl-row">
                      <dt>Contact Number</dt>
                      <dd>{g.contactNumber?.trim() ? g.contactNumber : "—"}</dd>
                    </div>
                    <div className="profile-dl-row">
                      <dt>Email address</dt>
                      <dd>
                        {g.email?.trim() ? (
                          <a href={`mailto:${g.email}`} className="text-[var(--color-primary)] hover:underline">
                            {g.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Enrollment History (newest first) ───────────────── */}
        <section className="profile-card profile-card-wide">
          <h2 className="profile-card-title">Enrollment History</h2>
          {enrollmentRows.length === 0 ? (
            <p className="text-muted">No enrollment records found.</p>
          ) : (
            <table className="data-table" id="enrollment-history-table">
              <thead>
                <tr>
                  <th>School Year</th>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {enrollmentRows.map((row) => {
                  const typeLabel =
                    row.studentType === "new_student"
                      ? "New"
                      : row.studentType === "transferee"
                        ? "Transferee"
                        : "Returning";
                  return (
                    <tr key={row.id}>
                      <td>{row.schoolYear}</td>
                      <td>{row.gradeLevel}</td>
                      <td className="text-muted">{row.sectionName ?? "—"}</td>
                      <td>{typeLabel}</td>
                      <td>
                        <span className="text-capitalize">{row.status}</span>
                      </td>
                      <td className="text-muted">
                        {row.enrolledAt
                          ? new Date(row.enrolledAt).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="text-muted">
                        {new Date(row.createdAt).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
