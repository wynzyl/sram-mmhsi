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
    <form className="flex flex-col gap-[1.125rem]" action={action} noValidate>
      {state?.message && (
        <div role="alert" className="flex items-start gap-2.5 px-3.5 py-3 border border-[#b91c1c]/30 dark:border-[#f87171]/30 border-l-[3px] border-l-[#b91c1c] dark:border-l-[#f87171] bg-[#fdf2f2] dark:bg-[#2a1717] rounded-md text-[0.8125rem] text-[#b91c1c] dark:text-[#f87171] leading-snug">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#b91c1c] dark:bg-[#f87171] mt-2 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-[0.4375rem]">
        <label htmlFor="username" className="text-[0.8125rem] font-medium text-[#1a1410] dark:text-[#f1ece6] tracking-tight">
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
            "w-full h-11 px-3.5 bg-white dark:bg-[#1c1716] border border-[#d4cabf] dark:border-[#3d3431] rounded-lg font-sans text-[0.9375rem] text-[#1a1410] dark:text-[#f1ece6] transition-all duration-150 placeholder:text-[#8a8079] dark:placeholder:text-[#87807a] hover:border-[#8a8079] dark:hover:border-[#87807a] focus:outline-none focus:border-[#7a0d10] dark:focus:border-[#c63232] focus:ring-[3px] focus:ring-[rgba(122,13,16,0.18)] dark:focus:ring-[rgba(198,50,50,0.28)] disabled:bg-[#fbf7f5] dark:disabled:bg-[#14100f] disabled:text-[#8a8079] dark:disabled:text-[#87807a] disabled:cursor-not-allowed",
            state?.errors?.username && "border-[#b91c1c] dark:border-[#f87171] focus:border-[#b91c1c] focus:ring-[rgba(185,28,28,0.14)]"
          )}
          placeholder="e.g. m.cruz or m.cruz@mmhsi.edu.ph"
        />
        {state?.errors?.username && (
          <p className="text-xs text-[#b91c1c] dark:text-[#f87171] m-0 leading-snug" role="alert">
            {state.errors.username[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[0.4375rem]">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="text-[0.8125rem] font-medium text-[#1a1410] dark:text-[#f1ece6] tracking-tight">
            Password
          </label>
          <Link href="/login/forgot" className="text-xs text-[#7a0d10] dark:text-[#c63232] font-medium no-underline border-b border-transparent transition-colors hover:border-[#7a0d10] dark:hover:border-[#c63232] focus-visible:outline-2 focus-visible:outline-[rgba(122,13,16,0.18)] focus-visible:outline-offset-2 focus-visible:rounded-sm">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            className={cn(
              "w-full h-11 px-3.5 pr-10 bg-white dark:bg-[#1c1716] border border-[#d4cabf] dark:border-[#3d3431] rounded-lg font-sans text-[0.9375rem] text-[#1a1410] dark:text-[#f1ece6] transition-all duration-150 placeholder:text-[#8a8079] dark:placeholder:text-[#87807a] hover:border-[#8a8079] dark:hover:border-[#87807a] focus:outline-none focus:border-[#7a0d10] dark:focus:border-[#c63232] focus:ring-[3px] focus:ring-[rgba(122,13,16,0.18)] dark:focus:ring-[rgba(198,50,50,0.28)] disabled:bg-[#fbf7f5] dark:disabled:bg-[#14100f] disabled:text-[#8a8079] dark:disabled:text-[#87807a] disabled:cursor-not-allowed",
              state?.errors?.password && "border-[#b91c1c] dark:border-[#f87171] focus:border-[#b91c1c] focus:ring-[rgba(185,28,28,0.14)]"
            )}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center bg-transparent border-none rounded-md text-[#8a8079] dark:text-[#87807a] cursor-pointer transition-colors hover:text-[#1a1410] dark:hover:text-[#f1ece6] hover:bg-[#fbf7f5] dark:hover:bg-[#14100f] focus-visible:outline-2 focus-visible:outline-[rgba(122,13,16,0.18)] focus-visible:outline-offset-1 focus-visible:text-[#1a1410] dark:focus-visible:text-[#f1ece6]"
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
          <p className="text-xs text-[#b91c1c] dark:text-[#f87171] m-0 leading-snug" role="alert">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="h-11 w-full mt-1 bg-[#7a0d10] dark:bg-[#c63232] text-white border border-[#7a0d10] dark:border-[#c63232] rounded-lg font-sans text-[0.9375rem] font-semibold tracking-[0.005em] cursor-pointer transition-all duration-150 shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(122,13,16,0.35)] hover:bg-[#5e0a0c] dark:hover:bg-[#d94646] hover:border-[#5e0a0c] dark:hover:border-[#d94646] active:translate-y-px active:shadow-[0_1px_0_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(122,13,16,0.18)] dark:focus-visible:ring-[rgba(198,50,50,0.28)] disabled:opacity-70 disabled:cursor-progress"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
