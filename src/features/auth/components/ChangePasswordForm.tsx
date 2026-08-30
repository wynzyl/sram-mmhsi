"use client";

import { useActionState } from "react";
import { changePasswordAction } from "../auth.actions";
import type { ChangePasswordFormState } from "../auth.schema";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/forms/PasswordField";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordFormState, FormData>(
    changePasswordAction,
    undefined
  );

  return (
    <form className="flex flex-col gap-[1.125rem]" action={action} noValidate>
      {state?.message && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 border-l-[3px] border-l-destructive bg-destructive-tint px-3.5 py-3 text-[0.8125rem] leading-snug text-destructive"
        >
          <span>{state.message}</span>
        </div>
      )}

      <PasswordField
        id="currentPassword"
        label="Current Password"
        autoComplete="current-password"
        placeholder="Enter your current password"
        disabled={pending}
        errors={state?.errors?.currentPassword}
      />

      <PasswordField
        id="newPassword"
        label="New Password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        disabled={pending}
        errors={state?.errors?.newPassword}
        footnote="Must contain uppercase, lowercase, and a number"
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm New Password"
        autoComplete="new-password"
        placeholder="Re-enter your new password"
        disabled={pending}
        errors={state?.errors?.confirmPassword}
      />

      <Button
        type="submit"
        variant="primary"
        className="mt-1 h-11 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Changing password..." : "Change Password"}
      </Button>
    </form>
  );
}
