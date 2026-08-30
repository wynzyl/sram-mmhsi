"use client";

import { useActionState } from "react";
import { changePortalPasswordAction } from "../portal-accounts.actions";
import type { ChangePortalPasswordFormState } from "../portal-accounts.schema";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/forms/PasswordField";

export function PortalChangePasswordForm() {
  const [state, action, pending] = useActionState<
    ChangePortalPasswordFormState,
    FormData
  >(changePortalPasswordAction, {});

  // No success handling here on purpose. changePortalPasswordAction ends with
  // deleteSession() then redirect("/login?message=password_changed"), so the
  // action never returns a success state to this component. Errors stay
  // inline: on an isolated auth card an inline alert is harder to miss.

  return (
    <form className="flex flex-col gap-[1.125rem]" action={action} noValidate>
      {state?.message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 border-l-[3px] border-l-destructive bg-destructive-tint px-3.5 py-3 text-[0.8125rem] leading-snug text-destructive"
        >
          <span>{state.message}</span>
        </div>
      ) : null}

      <PasswordField
        id="currentPassword"
        label="Current Password"
        autoComplete="current-password"
        placeholder="Enter your current password"
        disabled={pending}
        errors={state?.errors?.currentPassword}
        hint="Your date of birth in YYYYMMDD format (for example, 20100315)"
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
