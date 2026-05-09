"use client";

import { useActionState } from "react";
import { loginAction } from "../auth.actions";
import type { LoginFormState } from "../auth.schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form className="flex flex-col gap-4" action={action}>
      {state?.message && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-error)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-error)_10%,var(--color-surface))] px-3 py-2.5 text-sm font-medium text-[var(--color-error)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{state.message}</span>
        </div>
      )}

      <div>
        <label htmlFor="username" className="form-label">
          Username or Email
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
          className={cn("form-control", state?.errors?.username && "form-control-error")}
          placeholder="username or email@school.edu.ph"
        />
        {state?.errors?.username && (
          <p className="form-error">{state.errors.username[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={cn("form-control", state?.errors?.password && "form-control-error")}
          placeholder="••••••••••"
        />
        {state?.errors?.password && (
          <p className="form-error">{state.errors.password[0]}</p>
        )}
      </div>

      <Button type="submit" className="mt-1 w-full" size="lg" loading={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
