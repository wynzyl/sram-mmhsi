"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUserAction } from "../users.actions";
import type { UpdateUserFormState } from "../users.schema";
import { ROLE_LABELS } from "@/lib/constants/roles";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
}

interface EditUserFormProps {
  user: User;
}

const initialState: UpdateUserFormState = {};

export default function EditUserForm({ user }: EditUserFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateUserAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push(`/admin/users/${user.id}`);
    }
  }, [state.success, user.id, router]);

  return (
    <form action={action} className="form-card" noValidate>
      <input type="hidden" name="userId" value={user.id} />

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
            defaultValue={user.email}
            className={`form-control ${state.errors?.email ? "form-control-error" : ""}`}
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
            defaultValue={user.username}
            className={`form-control ${state.errors?.username ? "form-control-error" : ""}`}
            required
          />
          {state.errors?.username && (
            <p className="form-error">{state.errors.username[0]}</p>
          )}
        </div>
      </div>

      <div className="form-grid mt-4">
        <div className="form-group">
          <label className="form-label" htmlFor="role">
            Role <span className="required">*</span>
          </label>
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            className={`form-control ${state.errors?.role ? "form-control-error" : ""}`}
            required
          >
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

        <div className="form-group">
          <label className="form-label" htmlFor="isActive">
            Status <span className="required">*</span>
          </label>
          <select
            id="isActive"
            name="isActive"
            defaultValue={user.isActive ? "true" : "false"}
            className={`form-control ${state.errors?.isActive ? "form-control-error" : ""}`}
            required
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {state.errors?.isActive && (
            <p className="form-error">{state.errors.isActive[0]}</p>
          )}
        </div>
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
