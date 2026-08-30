"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePortalPasswordAction } from "../portal-accounts.actions";
import type { ChangePortalPasswordFormState } from "../portal-accounts.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  disabled: boolean;
  errors?: string[];
  /** Guidance shown above the input, e.g. the date-of-birth format. */
  hint?: ReactNode;
  /** Guidance shown below the input, e.g. the complexity rule. */
  footnote?: ReactNode;
}

/**
 * One labelled password input with a show/hide toggle.
 *
 * Extracted because this screen has three structurally identical fields; the
 * previous version repeated the whole block, including its own hardcoded
 * colour constants, three times.
 */
function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  disabled,
  errors,
  hint,
  footnote,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = hint || footnote ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>

      {hint ? (
        <p id={hintId} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}

      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          error={Boolean(errors?.length)}
          placeholder={placeholder}
          className="h-11 pr-11"
          aria-describedby={
            [errors?.length ? errorId : null, hintId].filter(Boolean).join(" ") ||
            undefined
          }
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {errors?.length ? (
        <p id={errorId} role="alert" className="text-xs leading-snug text-destructive">
          {errors[0]}
        </p>
      ) : null}

      {footnote ? (
        <p className="text-xs leading-snug text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}

export function PortalChangePasswordForm() {
  const [state, action, pending] = useActionState<
    ChangePortalPasswordFormState,
    FormData
  >(changePortalPasswordAction, {});

  // No success handling here on purpose. changePortalPasswordAction ends with
  // deleteSession() then redirect("/login?message=password_changed"), so the
  // action never returns a success state to this component. The previous
  // useFormToast onSuccess -> router.push("/portal/dashboard") could not fire.
  // Errors stay inline rather than in a toast: on an isolated auth card an
  // inline alert is harder to miss.

  return (
    <form className="flex flex-col gap-[1.125rem]" action={action} noValidate>
      {state?.message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 border-l-[3px] border-l-destructive bg-destructive/10 px-3.5 py-3 text-[0.8125rem] leading-snug text-destructive"
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
