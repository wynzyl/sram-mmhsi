"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import type { LoginFormState } from "@/lib/validators/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form id="login-form" className="login-form" action={action}>
      {/* Global error message */}
      {state?.message && (
        <div id="login-error" role="alert" className="login-alert">
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

      <div className="form-field">
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
          className={`form-input${state?.errors?.username ? " form-input--error" : ""}`}
          placeholder="username or email@school.edu.ph"
        />
        {state?.errors?.username && (
          <p className="form-error">{state.errors.username[0]}</p>
        )}
      </div>

      <div className="form-field">
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
          className={`form-input${state?.errors?.password ? " form-input--error" : ""}`}
          placeholder="••••••••••"
        />
        {state?.errors?.password && (
          <p className="form-error">{state.errors.password[0]}</p>
        )}
      </div>

      <button
        id="login-submit"
        type="submit"
        disabled={pending}
        className="btn-primary"
        aria-busy={pending}
      >
        {pending ? (
          <span className="btn-loading">
            <span className="spinner" aria-hidden="true" />
            Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
