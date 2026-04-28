"use client";

import { useActionState } from "react";
import { reviewRegistrationAction } from "@/actions/students";
import type { ReviewFormState } from "@/lib/validators/student";

interface ReviewFormProps {
  registrationId: string;
  studentName: string;
  onClose: () => void;
}

const initialState: ReviewFormState = {};

export default function RegistrationReviewForm({
  registrationId,
  studentName,
  onClose,
}: ReviewFormProps) {
  const [state, action, pending] = useActionState(reviewRegistrationAction, initialState);

  if (state.success) {
    return (
      <div className="review-success">
        <div className="review-success-icon">✓</div>
        <p>{state.message}</p>
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="review-form">
      <input type="hidden" name="registrationId" value={registrationId} />

      <h3 className="review-form-title">Review Registration</h3>
      <p className="review-form-student">
        Student: <strong>{studentName}</strong>
      </p>

      {state.message && (
        <div className="alert alert-error" role="alert">
          {state.message}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor={`review-remarks-${registrationId}`}>
          Remarks (optional)
        </label>
        <textarea
          id={`review-remarks-${registrationId}`}
          name="remarks"
          className="form-control"
          rows={3}
          placeholder="Add notes for the registrant..."
        />
      </div>

      <div className="review-form-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="submit"
          name="action"
          value="reject"
          className="btn-danger"
          id={`reject-reg-${registrationId}`}
          disabled={pending}
        >
          {pending ? "Processing..." : "Reject"}
        </button>
        <button
          type="submit"
          name="action"
          value="approve"
          className="btn-primary"
          id={`approve-reg-${registrationId}`}
          disabled={pending}
        >
          {pending ? "Processing..." : "Approve"}
        </button>
      </div>
    </form>
  );
}
