"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "../auth.actions";
import type { ChangePasswordFormState } from "../auth.schema";
import { cn } from "@/lib/utils/cn";

const FIELD_LABEL =
  "text-[0.8125rem] font-medium text-[#1a1410] dark:text-[#f1ece6] tracking-tight";

const INPUT_BASE =
  "w-full h-11 px-3.5 pr-10 bg-white dark:bg-[#1c1716] border border-[#d4cabf] dark:border-[#3d3431] rounded-lg font-sans text-[0.9375rem] text-[#1a1410] dark:text-[#f1ece6] transition-all duration-150 placeholder:text-[#8a8079] dark:placeholder:text-[#87807a] hover:border-[#8a8079] dark:hover:border-[#87807a] focus:outline-none focus:border-[#7a0d10] dark:focus:border-[#c63232] focus:ring-[3px] focus:ring-[rgba(122,13,16,0.18)] dark:focus:ring-[rgba(198,50,50,0.28)] disabled:bg-[#fbf7f5] dark:disabled:bg-[#14100f] disabled:text-[#8a8079] dark:disabled:text-[#87807a] disabled:cursor-not-allowed";

const INPUT_ERROR =
  "border-[#b91c1c] dark:border-[#f87171] focus:border-[#b91c1c] focus:ring-[rgba(185,28,28,0.14)]";

const EYE_BTN =
  "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center bg-transparent border-none rounded-md text-[#8a8079] dark:text-[#87807a] cursor-pointer transition-colors hover:text-[#1a1410] dark:hover:text-[#f1ece6] hover:bg-[#fbf7f5] dark:hover:bg-[#14100f] focus-visible:outline-2 focus-visible:outline-[rgba(122,13,16,0.18)] focus-visible:outline-offset-1 focus-visible:text-[#1a1410] dark:focus-visible:text-[#f1ece6]";

const FIELD_ERROR_TEXT =
  "text-xs text-[#b91c1c] dark:text-[#f87171] m-0 leading-snug";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordFormState, FormData>(
    changePasswordAction,
    undefined
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form className="flex flex-col gap-[1.125rem]" action={action} noValidate>
      {state?.message && (
        <div role="alert" className="flex items-start gap-2.5 px-3.5 py-3 border border-[#b91c1c]/30 dark:border-[#f87171]/30 border-l-[3px] border-l-[#b91c1c] dark:border-l-[#f87171] bg-[#fdf2f2] dark:bg-[#2a1717] rounded-md text-[0.8125rem] text-[#b91c1c] dark:text-[#f87171] leading-snug">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#b91c1c] dark:bg-[#f87171] mt-2 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-[0.4375rem]">
        <label htmlFor="currentPassword" className={FIELD_LABEL}>
          Current Password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            className={cn(INPUT_BASE, state?.errors?.currentPassword && INPUT_ERROR)}
            placeholder="Enter your current password"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((v) => !v)}
            className={EYE_BTN}
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            aria-pressed={showCurrentPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showCurrentPassword} />
          </button>
        </div>
        {state?.errors?.currentPassword && (
          <p className={FIELD_ERROR_TEXT} role="alert">
            {state.errors.currentPassword[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[0.4375rem]">
        <label htmlFor="newPassword" className={FIELD_LABEL}>
          New Password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            className={cn(INPUT_BASE, state?.errors?.newPassword && INPUT_ERROR)}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            className={EYE_BTN}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            aria-pressed={showNewPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showNewPassword} />
          </button>
        </div>
        {state?.errors?.newPassword && (
          <p className={FIELD_ERROR_TEXT} role="alert">
            {state.errors.newPassword[0]}
          </p>
        )}
        <p className="text-xs text-[#5b524a] dark:text-[#b8aea4] m-0 leading-snug">
          Must contain uppercase, lowercase, and a number
        </p>
      </div>

      <div className="flex flex-col gap-[0.4375rem]">
        <label htmlFor="confirmPassword" className={FIELD_LABEL}>
          Confirm New Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            className={cn(INPUT_BASE, state?.errors?.confirmPassword && INPUT_ERROR)}
            placeholder="Re-enter your new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className={EYE_BTN}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            aria-pressed={showConfirmPassword}
            tabIndex={0}
          >
            <PasswordIcon show={showConfirmPassword} />
          </button>
        </div>
        {state?.errors?.confirmPassword && (
          <p className={FIELD_ERROR_TEXT} role="alert">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="h-11 w-full mt-1 bg-[#7a0d10] dark:bg-[#c63232] text-white border border-[#7a0d10] dark:border-[#c63232] rounded-lg font-sans text-[0.9375rem] font-semibold tracking-[0.005em] cursor-pointer transition-all duration-150 shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(122,13,16,0.35)] hover:bg-[#5e0a0c] dark:hover:bg-[#d94646] hover:border-[#5e0a0c] dark:hover:border-[#d94646] active:translate-y-px active:shadow-[0_1px_0_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(122,13,16,0.18)] dark:focus-visible:ring-[rgba(198,50,50,0.28)] disabled:opacity-70 disabled:cursor-progress"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Changing password…" : "Change Password"}
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
