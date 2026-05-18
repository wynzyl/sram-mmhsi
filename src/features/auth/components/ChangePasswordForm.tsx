"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "../auth.actions";
import type { ChangePasswordFormState } from "../auth.schema";
import { cn } from "@/lib/utils/cn";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordFormState, FormData>(
    changePasswordAction,
    undefined
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form className="login-form" action={action} noValidate>
      {state?.message && (
        <div role="alert" className="login-alert">
          <span className="login-alert-dot" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="login-field">
        <label htmlFor="currentPassword" className="login-field-label">
          Current Password
        </label>
        <div className="login-input-wrap">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            className={cn(
              "login-input login-input-with-icon",
              state?.errors?.currentPassword && "login-input-error"
            )}
            placeholder="Enter your current password"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((v) => !v)}
            className="login-eye-btn"
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            aria-pressed={showCurrentPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showCurrentPassword} />
          </button>
        </div>
        {state?.errors?.currentPassword && (
          <p className="login-field-help" role="alert">
            {state.errors.currentPassword[0]}
          </p>
        )}
      </div>

      <div className="login-field">
        <label htmlFor="newPassword" className="login-field-label">
          New Password
        </label>
        <div className="login-input-wrap">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            className={cn(
              "login-input login-input-with-icon",
              state?.errors?.newPassword && "login-input-error"
            )}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            className="login-eye-btn"
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            aria-pressed={showNewPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showNewPassword} />
          </button>
        </div>
        {state?.errors?.newPassword && (
          <p className="login-field-help" role="alert">
            {state.errors.newPassword[0]}
          </p>
        )}
        <p className="login-field-hint">
          Must contain uppercase, lowercase, and a number
        </p>
      </div>

      <div className="login-field">
        <label htmlFor="confirmPassword" className="login-field-label">
          Confirm New Password
        </label>
        <div className="login-input-wrap">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            className={cn(
              "login-input login-input-with-icon",
              state?.errors?.confirmPassword && "login-input-error"
            )}
            placeholder="Re-enter your new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="login-eye-btn"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            aria-pressed={showConfirmPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showConfirmPassword} />
          </button>
        </div>
        {state?.errors?.confirmPassword && (
          <p className="login-field-help" role="alert">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="login-submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Changing password..." : "Change Password"}
      </button>
    </form>
  );
}

function PasswordIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
