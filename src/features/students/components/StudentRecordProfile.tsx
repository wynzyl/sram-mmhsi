import Link from "next/link";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { StudentRecordTabShell, type StudentRecordTabDef } from "@/features/students/components/StudentRecordTabShell";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import type { StudentRequirementsSnapshot } from "@/features/registrations/registrations.queries";
import {
  intakeFieldStatusDisplay,
  isIntakeDocumentsComplete,
  registrationStudentTypeLabel,
} from "@/lib/utils/intake-documents";

export type StudentRecordStudent = {
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  lrn: string | null;
  mobileNumber: string | null;
  email: string | null;
  nationality: string | null;
  bloodType: string | null;
  religion: string | null;
  previousSchool: string | null;
  submittedDocumentsNotes: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type GuardianRow = {
  id: string;
  isPrimary: boolean;
  firstName: string;
  middleName: string | null;
  lastName: string;
  relationship: string;
  address: string | null;
  contactNumber: string | null;
  email: string | null;
};

export type EnrollmentRecordRow = {
  id: string;
  createdAt: Date;
  enrolledAt: Date | null;
  status: string;
  studentType: string;
  schoolYear: string;
  schoolYearIsActive: boolean;
  gradeLevel: string;
  sectionName: string | null;
  assessmentId: string | null;
};

export type AssessmentSummaryRow = {
  id: string;
  schoolYear: string;
  totalAmount: string;
  totalPaid: string;
  balance: string;
  billingStatus: string;
};

export type InvoiceSummaryRow = {
  id: string;
  invoiceNumber: string;
  amountDue: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
};

export type CurrentPlacement = {
  schoolYear: string;
  gradeLevel: string;
  sectionName: string | null;
} | null;

export type StudentRecordFlags = {
  canReadAssessments: boolean;
  canCreateAssessment: boolean;
  canReadInvoices: boolean;
  canEnroll: boolean;
  canEditStudent: boolean;
  /** Cashier / admin — post payments from assessment ledger. */
  canPostPayments: boolean;
};

function computeAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function enrollmentTypeLabel(studentType: string): string {
  if (studentType === "new_student") return "New";
  if (studentType === "transferee") return "Transferee";
  if (studentType === "old_student") return "Old";
  return studentType.replace(/_/g, " ");
}

function invoiceStatusVariant(
  status: string
): "secondary" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "settled":
      return "success";
    case "sent":
      return "info";
    case "viewed":
      return "secondary";
    case "overdue":
      return "danger";
    default:
      return "warning";
  }
}

const INTAKE_REQUIREMENT_ROWS: {
  key: keyof EnrollmentIntakeDocuments;
  label: string;
}[] = [
  { key: "form138", label: "FORM 138" },
  { key: "birthCertificatePsa", label: "Birth Certificate (PSA)" },
  { key: "goodMoralCharacter", label: "Good Moral Character" },
  { key: "qualifiedVoucher", label: "Qualified Voucher Certificate (if any)" },
  { key: "escCertificate", label: "ESC Certificate (if any)" },
];

function RequirementsRecordCard({ snap }: { snap: StudentRequirementsSnapshot }) {
  const summaryComplete =
    snap.intakeDocuments != null && isIntakeDocumentsComplete(snap.intakeDocuments);

  return (
    <div className="student-record-card student-record-card-spacious">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold m-0">
            Enrollment{" "}
            <span className="student-record-muted font-normal text-sm">
              · {snap.schoolYear} · {snap.gradeLevel}
            </span>
          </h3>
          <p className="student-record-muted text-sm mt-1 m-0">
            Enrollment type {registrationStudentTypeLabel(snap.studentType)}
            {" · "}
            Recorded{" "}
            {snap.recordedAt.toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={snap.enrollmentStatus} type="enrollment" />
          {snap.intakeDocuments ? (
            summaryComplete ? (
              <Badge variant="success">Checklist complete</Badge>
            ) : (
              <Badge variant="warning">Checklist incomplete</Badge>
            )
          ) : (
            <Badge variant="secondary">No checklist data</Badge>
          )}
        </div>
      </div>

      {!snap.intakeDocuments ? (
        <p className="student-record-muted text-sm m-0">
          No intake checklist was stored for this enrollment.
        </p>
      ) : (
        <dl className="student-record-dl m-0">
          {INTAKE_REQUIREMENT_ROWS.map(({ key, label }) => {
            const raw = snap.intakeDocuments![key];
            const { label: statusLabel, variant } = intakeFieldStatusDisplay(raw);
            return (
              <div className="student-record-dl-row" key={key}>
                <dt>{label}</dt>
                <dd className="m-0">
                  <Badge variant={variant}>{statusLabel}</Badge>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function EnrollmentBillingCell({
  row,
  flags,
}: {
  row: EnrollmentRecordRow;
  flags: StudentRecordFlags;
}) {
  if (row.status === "cancelled") {
    return <span className="student-record-muted">—</span>;
  }

  if (flags.canReadAssessments && row.assessmentId) {
    return (
      <Link
        href={`/staff/assessments/${row.assessmentId}`}
        className="student-record-inline-link"
      >
        Open ledger
      </Link>
    );
  }

  if (row.status === "pending" && flags.canCreateAssessment) {
    return (
      <Link
        href={`/staff/assessments/new/${row.id}`}
        className="student-record-inline-link"
      >
        Build assessment
      </Link>
    );
  }

  if (row.status === "assessed" && !row.assessmentId && flags.canReadAssessments) {
    return <span className="student-record-muted student-record-text-sm">Missing ledger</span>;
  }

  return <span className="student-record-muted">—</span>;
}

export function StudentRecordProfile({
  student,
  guardians,
  enrollments: enrollmentRows,
  requirementsSnapshots,
  placement,
  assessmentSummaries,
  invoices,
  flags,
}: {
  student: StudentRecordStudent;
  guardians: GuardianRow[];
  enrollments: EnrollmentRecordRow[];
  requirementsSnapshots: StudentRequirementsSnapshot[];
  placement: CurrentPlacement;
  assessmentSummaries: AssessmentSummaryRow[];
  invoices: InvoiceSummaryRow[];
  flags: StudentRecordFlags;
}) {
  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");

  const age = student.dateOfBirth ? computeAge(new Date(student.dateOfBirth)) : null;

  const personalSection = (
    <div className="student-record-tabpanel-inner">
      <div className="student-record-card student-record-card-spacious">
        <dl className="student-record-dl">
          <div className="student-record-dl-row">
            <dt>Date of birth</dt>
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
          <div className="student-record-dl-row">
            <dt>Gender</dt>
            <dd className="text-capitalize">{student.gender ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Address</dt>
            <dd>{student.address ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>LRN</dt>
            <dd className="student-record-mono text-sm">{student.lrn ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Mobile</dt>
            <dd>{student.mobileNumber ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Email</dt>
            <dd>{student.email ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Nationality</dt>
            <dd>{student.nationality ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Blood type</dt>
            <dd>
              {student.bloodType ? (
                <span className="student-record-blood">{student.bloodType}</span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Religion</dt>
            <dd>{student.religion ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Previous school</dt>
            <dd>{student.previousSchool ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Documents (notes)</dt>
            <dd className="whitespace-pre-wrap">{student.submittedDocumentsNotes ?? "—"}</dd>
          </div>
          <div className="student-record-dl-row">
            <dt>Registered</dt>
            <dd>
              {new Date(student.createdAt).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );

  const guardiansSection = (
    <div className="student-record-tabpanel-inner">
      <div className="student-record-card student-record-card-spacious">
        {guardians.length === 0 ? (
          <p className="student-record-muted">No guardians on file.</p>
        ) : (
          <ul className="student-record-guardian-list">
            {guardians.map((g) => (
              <li key={g.id} className="student-record-guardian-item">
                <div className="student-record-guardian-name">
                  {g.firstName} {g.middleName} {g.lastName}
                  {g.isPrimary && <span className="student-record-primary-badge">Primary</span>}
                </div>
                <dl className="student-record-dl student-record-dl-guardian">
                  <div className="student-record-dl-row">
                    <dt>Relationship</dt>
                    <dd>{g.relationship}</dd>
                  </div>
                  <div className="student-record-dl-row">
                    <dt>Address</dt>
                    <dd>{g.address?.trim() ? g.address : "—"}</dd>
                  </div>
                  <div className="student-record-dl-row">
                    <dt>Contact</dt>
                    <dd>{g.contactNumber?.trim() ? g.contactNumber : "—"}</dd>
                  </div>
                  <div className="student-record-dl-row">
                    <dt>Email</dt>
                    <dd>
                      {g.email?.trim() ? (
                        <a href={`mailto:${g.email}`} className="student-record-inline-link">
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
      </div>
    </div>
  );

  const requirementsSection = (
    <div className="student-record-tabpanel-inner">
      {requirementsSnapshots.length === 0 ? (
        <div className="student-record-card student-record-card-spacious">
          <p className="student-record-muted m-0">
            No enrollment intake checklists on file for this student.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requirementsSnapshots.map((snap) => (
            <RequirementsRecordCard key={snap.enrollmentId} snap={snap} />
          ))}
        </div>
      )}
    </div>
  );

  const enrollmentsSection = (
    <div className="student-record-tabpanel-inner">
      <div className="student-record-card student-record-card-flush student-record-card-spacious-bleed">
        {enrollmentRows.length === 0 ? (
          <p className="student-record-muted student-record-card-pad">No enrollment records.</p>
        ) : (
          <div className="student-record-table-wrap">
            <table className="student-record-table" id="enrollment-history-table">
              <thead>
                <tr>
                  <th>School year</th>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Billing</th>
                  <th>Enrolled</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {enrollmentRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.schoolYear}</td>
                    <td>{row.gradeLevel}</td>
                    <td className="student-record-muted">{row.sectionName ?? "—"}</td>
                    <td>{enrollmentTypeLabel(row.studentType)}</td>
                    <td>
                      <StatusBadge status={row.status} type="enrollment" />
                    </td>
                    <td>
                      <EnrollmentBillingCell row={row} flags={flags} />
                    </td>
                    <td className="student-record-muted">
                      {row.enrolledAt
                        ? new Date(row.enrolledAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="student-record-muted">
                      {new Date(row.createdAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const billingSection = (
    <div className="student-record-tabpanel-inner">
      <div className="student-record-card student-record-card-flush student-record-card-spacious-bleed">
        {assessmentSummaries.length === 0 ? (
          <p className="student-record-muted student-record-card-pad">
            No assessment ledgers for this student.
          </p>
        ) : (
          <div className="student-record-table-wrap">
            <table className="student-record-table">
              <thead>
                <tr>
                  <th>School year</th>
                  <th>Assessed</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assessmentSummaries.map((a) => (
                  <tr key={a.id}>
                    <td>{a.schoolYear}</td>
                    <td>
                      <CurrencyDisplay amount={Number(a.totalAmount)} />
                    </td>
                    <td>
                      <CurrencyDisplay amount={Number(a.totalPaid)} />
                    </td>
                    <td>
                      <CurrencyDisplay amount={Number(a.balance)} />
                    </td>
                    <td>
                      <StatusBadge type="billing" status={a.billingStatus} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/staff/assessments/${a.id}`}
                        className="student-record-inline-link"
                      >
                        Ledger
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const invoicesSection = (
    <div className="student-record-tabpanel-inner">
      <div className="student-record-card student-record-card-flush student-record-card-spacious-bleed">
        {invoices.length === 0 ? (
          <p className="student-record-muted student-record-card-pad">No invoices for this student.</p>
        ) : (
          <div className="student-record-table-wrap">
            <table className="student-record-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="student-record-mono text-sm">{inv.invoiceNumber}</td>
                    <td>
                      <CurrencyDisplay amount={Number(inv.amountDue)} />
                    </td>
                    <td>
                      <Badge variant={invoiceStatusVariant(inv.status)} className="text-xs capitalize">
                        {inv.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="student-record-muted">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="student-record-muted">
                      {new Date(inv.createdAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/staff/finance/invoices/${inv.id}`}
                        className="student-record-inline-link"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const tabs: StudentRecordTabDef[] = [
    { id: "personal", label: "Personal & contact", content: personalSection },
    { id: "guardians", label: "Guardians", content: guardiansSection },
    { id: "requirements", label: "Requirements", content: requirementsSection },
    { id: "enrollments", label: "Enrollments", content: enrollmentsSection },
  ];

  if (flags.canReadAssessments) {
    tabs.push({ id: "billing", label: "Billing", content: billingSection });
  }
  if (flags.canReadInvoices) {
    tabs.push({ id: "invoices", label: "Invoices", content: invoicesSection });
  }

  return (
    <div className="student-record-page page-container">
      <Link href="/staff/students" className="student-record-back">
        ← Back to Students
      </Link>

      <header className="student-record-hero fade-in">
        <div className="student-record-hero-rule" aria-hidden />
        <div className="student-record-hero-unified">
          <div className="student-record-hero-primary">
            <div className="student-record-seal" aria-hidden>
              {student.firstName[0]}
              {student.lastName[0]}
            </div>
            <div className="student-record-hero-copy-block">
              <p className="student-record-kicker">Student record</p>
              <h1 className="student-record-name">{fullName}</h1>
              {placement ? (
                <p className="student-record-placement">
                  <span className="student-record-placement-label">Current enrollment</span>
                  <span className="student-record-placement-value">
                    {placement.gradeLevel}
                    {placement.sectionName ? ` · ${placement.sectionName}` : ""} — {placement.schoolYear}
                  </span>
                </p>
              ) : (
                <p className="student-record-placement student-record-muted">
                  No active school-year enrollment on file.
                </p>
              )}

              <div className="student-record-hero-meta">
                <div className="student-record-meta-tile">
                  <span className="student-record-meta-label">Reference</span>
                  <span className="student-record-meta-value">
                    <ReferenceCode code={student.referenceNumber} />
                  </span>
                </div>
                {student.lrn ? (
                  <div className="student-record-meta-tile">
                    <span className="student-record-meta-label">LRN</span>
                    <span className="student-record-meta-value student-record-mono">{student.lrn}</span>
                  </div>
                ) : null}
                {age !== null ? (
                  <div className="student-record-meta-tile">
                    <span className="student-record-meta-label">Age</span>
                    <span className="student-record-meta-value">{age}</span>
                  </div>
                ) : null}
                <div className="student-record-meta-tile">
                  <span className="student-record-meta-label">Status</span>
                  <span className="student-record-meta-value">
                    <span
                      className={`student-record-pill ${student.isActive ? "student-record-pill-success" : "student-record-pill-muted"}`}
                    >
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="student-record-hero-actions">
            {flags.canEnroll && (
              <Link
                href={`/staff/enrollments/new?studentId=${student.id}`}
                className="student-record-btn student-record-btn-primary"
                id="enroll-student-btn"
              >
                Enroll student
              </Link>
            )}
            {flags.canEditStudent && (
              <Link
                href={`/staff/students/${student.id}/edit`}
                className="student-record-btn student-record-btn-secondary"
                id="edit-student-btn"
              >
                Edit record
              </Link>
            )}
          </div>
        </div>
      </header>

      <StudentRecordTabShell tabs={tabs} />
    </div>
  );
}
