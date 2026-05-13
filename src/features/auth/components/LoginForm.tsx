"use client";

import { useActionState } from "react";
import { loginAction } from "../auth.actions";
import type { LoginFormState } from "../auth.schema";
import { cn } from "@/lib/utils/cn";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form className="editorial-form" action={action} noValidate>
      {state?.message && (
        <div role="alert" className="editorial-alert">
          <span className="editorial-alert-mark" aria-hidden="true">
            ※
          </span>
          <span>{state.message}</span>
        </div>
      )}

      <div className="editorial-field">
        <label htmlFor="username" className="editorial-field-label">
          <span className="editorial-field-num">i.</span>
          <span>Username or Institutional Email</span>
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
          className={cn(
            "editorial-input",
            state?.errors?.username && "editorial-input-error"
          )}
          placeholder="e.g. m.cruz  ·  m.cruz@mmhsi.edu.ph"
        />
        {state?.errors?.username && (
          <p className="editorial-input-help">
            <span aria-hidden="true">— </span>
            {state.errors.username[0]}
          </p>
        )}
      </div>

      <div className="editorial-field">
        <label htmlFor="password" className="editorial-field-label">
          <span className="editorial-field-num">ii.</span>
          <span>Passphrase</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={cn(
            "editorial-input",
            state?.errors?.password && "editorial-input-error"
          )}
          placeholder="••••••••••••"
        />
        {state?.errors?.password && (
          <p className="editorial-input-help">
            <span aria-hidden="true">— </span>
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="editorial-submit"
        disabled={pending}
        aria-busy={pending}
      >
        <span className="editorial-submit-rule" aria-hidden="true" />
        <span className="editorial-submit-label">
          {pending ? "Verifying entry…" : "Enter the system"}
        </span>
        <span className="editorial-submit-arrow" aria-hidden="true">
          →
        </span>
      </button>
    </form>
  );
}
