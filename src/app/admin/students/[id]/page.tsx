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
      status: registrations.status,
      remarks: registrations.remarks,
      reviewedAt: registrations.reviewedAt,
      createdAt: registrations.createdAt,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(registrations)
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .where(eq(registrations.studentId, id))
    .orderBy(desc(registrations.createdAt));

  // Determine if the student has at least one approved registration (required to enroll)
  const hasApprovedReg = regRows.some((r) => r.status === "approved");

  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");

  const statusColors: Record<string, string> = {
    pending: "badge-warning",
    approved: "badge-success",
    rejected: "badge-danger",
  };

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
          {hasPermission(session.role, "enrollments:create") && hasApprovedReg && (
            <Link
              href={`/admin/enrollments/new?studentId=${id}`}
              className="btn-secondary"
              id="enroll-student-btn"
            >
              Enroll Student
            </Link>
          )}
          {hasPermission(session.role, "enrollments:create") && !hasApprovedReg && (
            <span
              className="btn-secondary btn-disabled"
              title="Student must have an approved registration before enrolling"
              aria-disabled="true"
            >
              Enroll Student
            </span>
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
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Reviewed On</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {regRows.map((reg) => (
                  <tr key={reg.id}>
                    <td>{reg.schoolYear}</td>
                    <td>{reg.gradeLevel}</td>
                    <td>
                      <span className={`badge ${statusColors[reg.status] ?? "badge-secondary"}`}>
                        {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-muted">{reg.remarks ?? "—"}</td>
                    <td className="text-muted">
                      {reg.reviewedAt
                        ? new Date(reg.reviewedAt).toLocaleDateString("en-PH")
                        : "—"}
                    </td>
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
