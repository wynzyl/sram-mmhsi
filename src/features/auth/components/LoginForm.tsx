"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../auth.actions";
import type { LoginFormState } from "../auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/forms/PasswordField";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    loginAction,
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username or school email</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
          error={Boolean(state?.errors?.username?.length)}
          className="h-11"
          placeholder="e.g. m.cruz or m.cruz@mmhsi.edu.ph"
          aria-describedby={state?.errors?.username?.length ? "username-error" : undefined}
        />
        {state?.errors?.username && (
          <p id="username-error" role="alert" className="text-xs leading-snug text-destructive">
            {state.errors.username[0]}
          </p>
        )}
      </div>

      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        disabled={pending}
        errors={state?.errors?.password}
        labelEnd={
          <Link
            href="/login/forgot"
            className="text-xs font-medium text-info transition-colors hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Forgot password?
          </Link>
        }
      />

      <Button
        type="submit"
        variant="primary"
        className="mt-1 h-11 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
