"use client";

import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { Badge } from "@/components/ui/badge";
import { deleteSubjectAction } from "../subjects/subjects.actions";
import SubjectIcon from "./SubjectIcon";
import type { SubjectListRow } from "../subjects/subjects.queries";

interface SubjectsTableProps {
  subjects: SubjectListRow[];
}

/**
 * Subject list table with icons, status badges, and actions
 */
export default function SubjectsTable({ subjects }: SubjectsTableProps) {
  if (subjects.length === 0) {
    return (
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject Name</th>
              <th>Code</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="table-empty">
                No subjects found for this grade level.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Subject Name</th>
            <th>Code</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id} className="table-row-hover">
              <td>
                <div className="flex items-center gap-3">
                  <SubjectIcon code={subject.code} />
                  <div>
                    <div className="font-medium text-foreground">
                      {subject.name}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span className="font-mono text-sm text-muted-foreground">
                  {subject.code}
                </span>
              </td>
              <td>
                <Badge variant="success">Active</Badge>
              </td>
              <td className="text-right">
                <InlineConfirmButton
                  action={deleteSubjectAction}
                  confirmMessage="Are you sure you want to delete this subject?"
                  hiddenFields={{ subjectId: subject.id }}
                  label="Delete"
                  loadingLabel="Deleting..."
                  variant="danger"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
