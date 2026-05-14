"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction } from "../auth.actions";
import type { LoginFormState } from "../auth.schema";
import { cn } from "@/lib/utils/cn";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    loginAction,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="login-form" action={action} noValidate>
      {state?.message && (
        <div role="alert" className="login-alert">
          <span className="login-alert-dot" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="login-field">
        <label htmlFor="username" className="login-field-label">
          Username or school email
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
          className={cn(
            "login-input",
            state?.errors?.username && "login-input-error"
          )}
          placeholder="e.g. m.cruz or m.cruz@mmhsi.edu.ph"
        />
        {state?.errors?.username && (
          <p className="login-field-help" role="alert">
            {state.errors.username[0]}
          </p>
        )}
      </div>

      <div className="login-field">
        <div className="login-field-row">
          <label htmlFor="password" className="login-field-label">
            Password
          </label>
          <Link href="/login/forgot" className="login-link">
            Forgot password?
          </Link>
        </div>
        <div className="login-input-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            className={cn(
              "login-input login-input-with-icon",
              state?.errors?.password && "login-input-error"
            )}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="login-eye-btn"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={0}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {state?.errors?.password && (
          <p className="login-field-help" role="alert">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="login-submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
