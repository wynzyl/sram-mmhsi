"use client";

import { Badge } from "@/components/ui/badge";
import { StudentRowActionsMenu } from "@/components/students/StudentRowActionsMenu";

export interface StudentRow {
  /** Stable row key (one list row per enrollment). */
  enrollmentId: string;
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  dateOfBirthIso: string | null;
  isActive: boolean;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  sectionName: string | null;
  dateEnrolledIso: string | null;
}

function computeAge(dobIso: string): number {
  const dob = new Date(dobIso);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) {
    return <span className="text-muted">—</span>;
  }

  const map: Record<string, { label: string; variant: "success" | "danger" | "info" | "secondary" }> = {
    male: { label: "M", variant: "info" },
    female: { label: "F", variant: "danger" },
    other: { label: "O", variant: "secondary" },
    prefer_not_to_say: { label: "?", variant: "secondary" },
  };

  const entry = map[gender] ?? { label: gender[0].toUpperCase(), variant: "secondary" as const };

  return (
    <Badge
      variant={entry.variant}
      className="h-6 min-h-6 w-6 min-w-6 shrink-0 p-0 text-xs font-bold"
      title={gender.replace(/_/g, " ")}
    >
      {entry.label}
    </Badge>
  );
}

type StudentBasePath = "/admin/students" | "/staff/students";

interface StudentsTableProps {
  rows: StudentRow[];
  emptyMessage?: string;
  studentBasePath?: StudentBasePath;
}

export function StudentsTable({
  rows,
  emptyMessage = "No students have been registered yet.",
  studentBasePath = "/admin/students",
}: StudentsTableProps) {
  const colSpan = 10;

  return (
    <div className="table-wrapper">
      <table className="data-table" id="students-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Name</th>
            <th>School Year</th>
            <th>Grade Level</th>
            <th>Section</th>
            <th>Date Enrolled</th>
            <th>Birthdate</th>
            <th>Sex</th>
            <th>Status</th>
            <th className="text-right w-px" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((s) => {
              const displayName = `${s.lastName}, ${s.firstName}${s.middleName ? ` ${s.middleName[0]}.` : ""}`;
              const dob = s.dateOfBirthIso;
              return (
                <tr key={s.enrollmentId} className="table-row-hover">
                  <td>
                    <code className="reference-code">{s.referenceNumber}</code>
                  </td>
                  <td className="student-name">{displayName}</td>
                  <td>{s.schoolYearLabel ?? <span className="text-muted">—</span>}</td>
                  <td>{s.gradeLevelName ?? <span className="text-muted">—</span>}</td>
                  <td>{s.sectionName ?? <span className="text-muted">—</span>}</td>
                  <td>
                    {!s.dateEnrolledIso ? (
                      <span className="text-muted">—</span>
                    ) : (
                      new Date(s.dateEnrolledIso).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    )}
                  </td>
                  <td>
                    {!dob ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <>
                        {new Date(dob).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        <span className="text-muted">({computeAge(dob)}y)</span>
                      </>
                    )}
                  </td>
                  <td>
                    <GenderBadge gender={s.gender} />
                  </td>
                  <td>
                    <Badge variant={s.isActive ? "success" : "danger"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="text-right align-middle">
                    <StudentRowActionsMenu studentId={s.id} studentBasePath={studentBasePath} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
