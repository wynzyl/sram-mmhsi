"use client";

import { useState } from "react";
import type { GuardianInput } from "@/lib/validators/student";

interface GuardianFormProps {
  index: number;
  guardian: GuardianInput;
  canRemove: boolean;
  onChange: (index: number, guardian: GuardianInput) => void;
  onRemove: (index: number) => void;
}

export default function GuardianForm({
  index,
  guardian,
  canRemove,
  onChange,
  onRemove,
}: GuardianFormProps) {
  const update = (field: keyof GuardianInput, value: string | boolean) =>
    onChange(index, { ...guardian, [field]: value });

  return (
    <div className="guardian-card">
      <div className="guardian-card-header">
        <h4 className="guardian-card-title">
          Guardian {index + 1}
          {guardian.isPrimary && (
            <span className="guardian-badge-primary">Primary</span>
          )}
        </h4>
        <div className="guardian-card-actions">
          {!guardian.isPrimary && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => update("isPrimary", true)}
            >
              Set as Primary
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-firstName`}>
            First Name <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-firstName`}
            type="text"
            className="form-control"
            value={guardian.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-middleName`}>
            Middle Name
          </label>
          <input
            id={`guardian-${index}-middleName`}
            type="text"
            className="form-control"
            value={guardian.middleName ?? ""}
            onChange={(e) => update("middleName", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-lastName`}>
            Last Name <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-lastName`}
            type="text"
            className="form-control"
            value={guardian.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-relationship`}>
            Relationship <span className="required">*</span>
          </label>
          <select
            id={`guardian-${index}-relationship`}
            className="form-control"
            value={guardian.relationship}
            onChange={(e) => update("relationship", e.target.value)}
            required
          >
            <option value="">Select relationship</option>
            <option value="Mother">Mother</option>
            <option value="Father">Father</option>
            <option value="Grandmother">Grandmother</option>
            <option value="Grandfather">Grandfather</option>
            <option value="Aunt">Aunt</option>
            <option value="Uncle">Uncle</option>
            <option value="Legal Guardian">Legal Guardian</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-contactNumber`}>
            Contact Number
          </label>
          <input
            id={`guardian-${index}-contactNumber`}
            type="tel"
            className="form-control"
            value={guardian.contactNumber ?? ""}
            onChange={(e) => update("contactNumber", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`guardian-${index}-email`}>
            Email Address
          </label>
          <input
            id={`guardian-${index}-email`}
            type="email"
            className="form-control"
            value={guardian.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
