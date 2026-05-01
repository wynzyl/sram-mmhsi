import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  registrations,
  schoolYears,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
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

  // Fetch student with guardians and registration history
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

      isActive: true,
      createdAt: true,
    },
  });

  if (!student) notFound();

  // Fetch guardians
  const guardianLinks = await db
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

  // Fetch registrations
  const regRows = await db
    .select({
      id: registrations.id,
      createdAt: registrations.createdAt,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(registrations)
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .where(eq(registrations.studentId, id))
    .orderBy(desc(registrations.createdAt));

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
              {guardianLinks.map((g, i) => (
                <li key={i} className="guardian-item">
                  <div className="guardian-item-name">
                    {g.firstName} {g.middleName} {g.lastName}
                    {g.isPrimary && (
                      <span className="guardian-badge-primary">Primary</span>
                    )}
                  </div>
                  <div className="guardian-item-meta">
                    <span>{g.relationship}</span>
                    {g.contactNumber && <span>📞 {g.contactNumber}</span>}
                    {g.email && <span>✉ {g.email}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Registration History ─────────────────────────────── */}
        <section className="profile-card profile-card-wide">
          <h2 className="profile-card-title">Registration History</h2>
          {regRows.length === 0 ? (
            <p className="text-muted">No registration records found.</p>
          ) : (
            <table className="data-table" id="registration-history-table">
              <thead>
                <tr>
                  <th>School Year</th>
                  <th>Grade Level</th>
                  <th>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {regRows.map((reg) => (
                  <tr key={reg.id}>
                    <td>{reg.schoolYear}</td>
                    <td>{reg.gradeLevel}</td>
                    <td className="text-muted">
                      {new Date(reg.createdAt).toLocaleDateString("en-PH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
