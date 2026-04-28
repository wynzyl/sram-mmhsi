"use client";

import { useState } from "react";
import RegistrationReviewForm from "./RegistrationReviewForm";

interface RegistrationRow {
  id: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  status: string;
  createdAt: Date;
}

interface RegistrationsTableProps {
  registrations: RegistrationRow[];
  canReview: boolean;
}

const statusColors: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

export default function RegistrationsTable({
  registrations,
  canReview,
}: RegistrationsTableProps) {
  const [activeReview, setActiveReview] = useState<string | null>(null);

  const reg = registrations.find((r) => r.id === activeReview);

  return (
    <>
      {/* Review Modal */}
      {activeReview && reg && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Review Registration"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveReview(null);
          }}
        >
          <div className="modal-content">
            <RegistrationReviewForm
              registrationId={reg.id}
              studentName={`${reg.studentName} (${reg.referenceNumber})`}
              onClose={() => setActiveReview(null)}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table" id="registrations-table">
          <thead>
            <tr>
              <th>Reference No.</th>
              <th>Student Name</th>
              <th>School Year</th>
              <th>Grade Level</th>
              <th>Status</th>
              <th>Submitted</th>
              {canReview && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {registrations.length === 0 ? (
              <tr>
                <td colSpan={canReview ? 7 : 6} className="table-empty">
                  No pending registrations.
                </td>
              </tr>
            ) : (
              registrations.map((reg) => (
                <tr key={reg.id} className="table-row-hover">
                  <td>
                    <code className="reference-code">{reg.referenceNumber}</code>
                  </td>
                  <td className="student-name">{reg.studentName}</td>
                  <td>{reg.schoolYear}</td>
                  <td>{reg.gradeLevel}</td>
                  <td>
                    <span className={`badge ${statusColors[reg.status] ?? "badge-secondary"}`}>
                      {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                    </span>
                  </td>
                  <td className="text-muted">
                    {new Date(reg.createdAt).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  {canReview && (
                    <td>
                      {reg.status === "pending" ? (
                        <button
                          className="table-action-link"
                          id={`review-reg-${reg.id}`}
                          onClick={() => setActiveReview(reg.id)}
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
