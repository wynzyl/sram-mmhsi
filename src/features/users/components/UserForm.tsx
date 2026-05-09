"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "../users.actions";
import type { CreateUserFormState } from "../users.schema";
import { ROLE_LABELS } from "@/lib/constants/roles";

const initialState: CreateUserFormState = {};

export default function UserForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createUserAction, initialState);

  useEffect(() => {
    if (state.success && state.userId) {
      router.push(`/admin/users/${state.userId}`);
    }
  }, [state.success, state.userId, router]);

  return (
    <form action={action} className="form-card" noValidate>
      {state.errors?._form && (
        <div className="alert alert-error mb-4">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="alert alert-error mb-4">{state.message}</div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email <span className="required">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className={`form-control ${state.errors?.email ? "form-control-error" : ""}`}
            placeholder="user@example.com"
            required
          />
          {state.errors?.email && (
            <p className="form-error">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="username">
            Username <span className="required">*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            className={`form-control ${state.errors?.username ? "form-control-error" : ""}`}
            placeholder="john_doe"
            required
          />
          {state.errors?.username && (
            <p className="form-error">{state.errors.username[0]}</p>
          )}
        </div>
      </div>

      <div className="form-grid mt-4">
        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password <span className="required">*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            className={`form-control ${state.errors?.password ? "form-control-error" : ""}`}
            placeholder="Minimum 8 characters"
            required
          />
          {state.errors?.password && (
            <p className="form-error">{state.errors.password[0]}</p>
          )}
          <p className="form-hint">
            Must be at least 8 characters with uppercase, lowercase, and number.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="role">
            Role <span className="required">*</span>
          </label>
          <select
            id="role"
            name="role"
            className={`form-control ${state.errors?.role ? "form-control-error" : ""}`}
            required
          >
            <option value="">Select role...</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {state.errors?.role && (
            <p className="form-error">{state.errors.role[0]}</p>
          )}
        </div>
      </div>

      <div className="form-group mt-4">
        <label className="form-checkbox">
          <input
            type="checkbox"
            name="forcePasswordChange"
            value="true"
            defaultChecked
          />
          <span>Force password change on next login</span>
        </label>
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Create User"}
        </button>
      </div>
    </form>
  );
}
