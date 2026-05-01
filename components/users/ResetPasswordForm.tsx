"use client";

import { useActionState, useEffect } from "react";
import { resetPasswordAction } from "@/actions/users";
import type { ResetPasswordFormState } from "@/lib/validators/user";

interface ResetPasswordFormProps {
  userId: string;
}

const initialState: ResetPasswordFormState = {};

export default function ResetPasswordForm({ userId }: ResetPasswordFormProps) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  useEffect(() => {
    if (state.success) {
      // Reset the form
      const form = document.getElementById("reset-password-form") as HTMLFormElement;
      form?.reset();
    }
  }, [state.success]);

  return (
    <form id="reset-password-form" action={action} className="form-card" noValidate>
      <input type="hidden" name="userId" value={userId} />

      {state.errors?._form && (
        <div className="alert alert-error mb-4">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && state.success && (
        <div className="alert alert-success mb-4">{state.message}</div>
      )}
      {state.message && !state.success && (
        <div className="alert alert-error mb-4">{state.message}</div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="newPassword">
          New Password <span className="required">*</span>
        </label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          className={`form-control ${state.errors?.newPassword ? "form-control-error" : ""}`}
          placeholder="Minimum 8 characters"
          required
        />
        {state.errors?.newPassword && (
          <p className="form-error">{state.errors.newPassword[0]}</p>
        )}
        <p className="form-hint">
          Must be at least 8 characters with uppercase, lowercase, and number.
        </p>
      </div>

      <div className="form-group mt-4">
        <label className="form-checkbox">
          <input
            type="checkbox"
            name="forcePasswordChange"
            value="true"
            defaultChecked
          />
          <span>Force password change on next login</span>
        </label>
      </div>

      <div className="form-actions mt-6">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </form>
  );
}
