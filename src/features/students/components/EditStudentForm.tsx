"use client";

/* eslint-disable react/no-children-prop -- TanStack Form's <form.Field> uses children as a render-prop function; this is its documented API. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Home, User, Users } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useUpdateStudent } from "../hooks/use-students";
import {
  GuardianSchema,
  type UpdateStudentFormState,
  type GuardianInput,
} from "../students.schema";
import {
  nameSchema,
  emailSchema,
  lrnSchema,
  phoneSchema,
} from "@/lib/validators/common-schemas";
import { useFormToast } from "@/hooks/useFormToast";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatPhoneInput, stripPhoneFormat } from "@/lib/utils/phone";
import GuardianForm from "./GuardianForm";

interface StudentData {
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;

  lrn: string | null;
  mobileNumber: string | null;
  email: string | null;
  nationality: string | null;
  bloodType: string | null;
  religion: string | null;

  previousSchool: string | null;
  submittedDocumentsNotes: string | null;

  isActive: boolean;
}

interface EditStudentFormProps {
  student: StudentData;
  initialGuardians: GuardianInput[];
  /** When true, Active cannot be toggled (enforced server-side too). */
  isActiveLocked?: boolean;
  /** Client redirect after successful save (default admin student profile). */
  afterSaveRedirect?: string;
  /** Explicit cancel target (profile). */
  cancelHref: string;
}

type FormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  lrn: string;
  mobileNumber: string;
  email: string;
  nationality: string;
  bloodType: string;
  religion: string;
  previousSchool: string;
  submittedDocumentsNotes: string;
  isActive: boolean;
  guardians: GuardianInput[];
};

const emptyGuardian = (): GuardianInput => ({
  firstName: "",
  middleName: "",
  lastName: "",
  relationship: "",
  address: "",
  occupation: "",
  contactNumber: "",
  email: "",
  isPrimary: false,
});

const initialState: UpdateStudentFormState = {};

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);

/** Adapt a Zod schema to a TanStack Form field validator returning string | undefined. */
const zodCheck =
  (schema: z.ZodType) =>
  ({ value }: { value: unknown }): string | undefined => {
    const r = schema.safeParse(value);
    return r.success ? undefined : r.error.issues[0]?.message;
  };

/** Whole-array guardian validator: each row valid + exactly one primary. */
const validateGuardians = ({ value }: { value: GuardianInput[] }): string | undefined => {
  if (!value || value.length === 0) return "At least one guardian is required.";
  for (let i = 0; i < value.length; i++) {
    const r = GuardianSchema.safeParse(value[i]);
    if (!r.success) {
      const issue = r.error.issues[0];
      const fieldName = String(issue?.path[0] ?? "details");
      return `Guardian ${i + 1}: ${issue?.message ?? `please complete the ${fieldName} field.`}`;
    }
  }
  if (!value.some((g) => g.isPrimary)) return "Mark one guardian as the primary contact.";
  return undefined;
};

type ServerErrors = Record<string, string[] | undefined> | undefined;

type AnyField = {
  name: string;
  state: { value: string; meta: { errors: unknown[] } };
  handleChange: (v: never) => void;
  handleBlur: () => void;
};

function clientError(errors: unknown[]): string | null {
  if (!errors || errors.length === 0) return null;
  const first = errors[0] as { message?: string } | string | undefined;
  if (!first) return null;
  return typeof first === "string" ? first : first.message ?? "Invalid value.";
}

function mergedError(field: AnyField, serverErrors: ServerErrors): string | null {
  return clientError(field.state.meta.errors) ?? serverErrors?.[field.name]?.[0] ?? null;
}

export default function EditStudentForm({
  student,
  initialGuardians,
  isActiveLocked = false,
  afterSaveRedirect,
  cancelHref,
}: EditStudentFormProps) {
  const router = useRouter();
  const updateStudent = useUpdateStudent();
  const state: UpdateStudentFormState = updateStudent.data ?? initialState;
  const serverErrors = state.errors as ServerErrors;
  const pending = updateStudent.isPending;

  useFormToast(state, {
    successMessage: "Student updated successfully",
    onSuccess: () => router.push(afterSaveRedirect ?? `/staff/students/${student.id}`),
  });

  const form = useForm({
    defaultValues: {
      firstName: student.firstName ?? "",
      middleName: student.middleName ?? "",
      lastName: student.lastName ?? "",
      suffix: student.suffix ?? "",
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: student.gender ?? "",
      address: student.address ?? "",
      lrn: student.lrn ?? "",
      mobileNumber: student.mobileNumber ?? "",
      email: student.email ?? "",
      nationality: student.nationality ?? "",
      bloodType: student.bloodType ?? "",
      religion: student.religion ?? "",
      previousSchool: student.previousSchool ?? "",
      submittedDocumentsNotes: student.submittedDocumentsNotes ?? "",
      isActive: student.isActive,
      guardians:
        initialGuardians.length > 0
          ? initialGuardians
          : [{ ...emptyGuardian(), isPrimary: true }],
    } as FormValues,
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      const scalarKeys: (keyof FormValues)[] = [
        "firstName", "middleName", "lastName", "suffix", "dateOfBirth", "gender",
        "address", "lrn", "mobileNumber", "email", "nationality", "bloodType",
        "religion", "previousSchool", "submittedDocumentsNotes",
      ];
      for (const k of scalarKeys) fd.set(k, String(value[k] ?? ""));
      const effectiveActive = isActiveLocked ? student.isActive : value.isActive;
      fd.set("isActive", effectiveActive ? "true" : "false");
      fd.set("guardians", JSON.stringify(value.guardians));
      updateStudent.mutate(fd);
    },
  });

  // ── Guardian array helpers (single-primary invariant via whole-array writes) ──
  const guardianList = () => form.getFieldValue("guardians") as GuardianInput[];

  const onGuardianChange = (index: number, guardian: GuardianInput) => {
    const next = [...guardianList()];
    if (guardian.isPrimary) {
      next.forEach((g, i) => {
        if (i !== index) next[i] = { ...g, isPrimary: false };
      });
    }
    next[index] = guardian;
    form.setFieldValue("guardians", next);
  };

  const onGuardianRemove = (index: number) => {
    const next = guardianList().filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((g) => g.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    form.setFieldValue("guardians", next);
  };

  const addGuardian = () => {
    form.setFieldValue("guardians", [...guardianList(), emptyGuardian()]);
  };

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-border pb-4 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
          <User className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          Student information
        </h2>
        <div className="form-grid form-grid-3">
          <form.Field
            name="firstName"
            validators={{ onChange: zodCheck(nameSchema) }}
            children={(field) => (
              <EditField label="First Name" required field={field} serverErrors={serverErrors} autoComplete="given-name" />
            )}
          />
          <form.Field
            name="middleName"
            children={(field) => (
              <EditField label="Middle Name" field={field} serverErrors={serverErrors} autoComplete="additional-name" />
            )}
          />
          <form.Field
            name="lastName"
            validators={{ onChange: zodCheck(nameSchema) }}
            children={(field) => (
              <EditField label="Last Name" required field={field} serverErrors={serverErrors} autoComplete="family-name" />
            )}
          />
          <form.Field
            name="suffix"
            children={(field) => (
              <EditSelect
                label="Suffix"
                field={field}
                serverErrors={serverErrors}
                options={[["", "None"], ["Jr.", "Jr."], ["Sr.", "Sr."], ["II", "II"], ["III", "III"], ["IV", "IV"]]}
              />
            )}
          />
          <form.Field
            name="dateOfBirth"
            validators={{ onChange: zodCheck(requiredText("Date of birth")) }}
            children={(field) => (
              <EditField label="Date of Birth" required type="date" field={field} serverErrors={serverErrors} />
            )}
          />
          <form.Field
            name="gender"
            children={(field) => (
              <EditSelect
                label="Gender"
                required
                field={field}
                serverErrors={serverErrors}
                options={[["", "Select gender"], ["male", "Male"], ["female", "Female"]]}
              />
            )}
          />
        </div>

        <div className="mt-4">
          <form.Field
            name="address"
            children={(field) => <EditTextArea label="Address" field={field} serverErrors={serverErrors} rows={2} />}
          />
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-border pb-4 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
          <Home className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          Contact &amp; additional information
        </h2>
        <div className="form-grid form-grid-3">
          <form.Field
            name="lrn"
            validators={{ onChange: zodCheck(lrnSchema) }}
            children={(field) => (
              <EditField label="Learner Reference Number (LRN)" field={field} serverErrors={serverErrors} maxLength={12} placeholder="12-digit DepEd LRN" />
            )}
          />
          <form.Field
            name="mobileNumber"
            validators={{ onChange: zodCheck(phoneSchema) }}
            children={(field) => <EditPhone label="Mobile Number" field={field} serverErrors={serverErrors} />}
          />
          <form.Field
            name="email"
            validators={{ onChange: zodCheck(emailSchema) }}
            children={(field) => (
              <EditField label="Email Address" type="email" field={field} serverErrors={serverErrors} autoComplete="email" placeholder="student@example.com" />
            )}
          />
          <form.Field
            name="nationality"
            children={(field) => <EditField label="Nationality" field={field} serverErrors={serverErrors} placeholder="Filipino" />}
          />
          <form.Field
            name="bloodType"
            children={(field) => (
              <EditSelect
                label="Blood Type"
                field={field}
                serverErrors={serverErrors}
                options={[["", "Unknown"], ["A+", "A+"], ["A-", "A-"], ["B+", "B+"], ["B-", "B-"], ["AB+", "AB+"], ["AB-", "AB-"], ["O+", "O+"], ["O-", "O-"]]}
              />
            )}
          />
          <form.Field
            name="religion"
            children={(field) => <EditField label="Religion" field={field} serverErrors={serverErrors} placeholder="Roman Catholic" />}
          />
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-border pb-4 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          Registration / transfer notes
        </h2>
        <form.Field
          name="previousSchool"
          children={(field) => (
            <EditField
              label="Previous school"
              field={field}
              serverErrors={serverErrors}
              placeholder="For transferee enrollments, record prior school before assessment"
            />
          )}
        />
        <div className="mt-4">
          <form.Field
            name="submittedDocumentsNotes"
            children={(field) => (
              <EditTextArea label="Submitted documents (notes)" field={field} serverErrors={serverErrors} rows={3} />
            )}
          />
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
          Record status
        </h2>
        <div className="rounded-xl border border-border bg-muted p-4">
          <div className="flex flex-row items-start gap-3">
            <form.Field
              name="isActive"
              children={(field) => (
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActiveLocked ? student.isActive : field.state.value}
                  disabled={isActiveLocked}
                  onChange={(e) => field.handleChange(e.target.checked as never)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed dark:border-gray-700"
                />
              )}
            />
            <div className="min-w-0">
              <label className="form-label m-0 cursor-pointer" htmlFor="isActive">
                Active student
              </label>
              {isActiveLocked ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Active cannot be changed while this student has an enrollment in{" "}
                  <strong className="text-foreground">Enrolled</strong> status.
                </p>
              ) : null}
              {serverErrors?.isActive?.[0] && (
                <p className="form-error mt-1" role="alert">
                  {serverErrors.isActive[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      </DataCard>

      <DataCard className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <h2 className="flex items-center gap-3 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Parents / guardians
          </h2>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
            onClick={addGuardian}
          >
            + Add guardian
          </button>
        </div>

        <form.Field
          name="guardians"
          validators={{ onChange: validateGuardians }}
          children={(field) => {
            const arrayErr = clientError(field.state.meta.errors) ?? serverErrors?.guardians?.[0] ?? null;
            const guardians = field.state.value as GuardianInput[];
            return (
              <>
                {arrayErr && <p className="form-error mb-4">{arrayErr}</p>}
                <div className="guardian-list flex flex-col gap-4">
                  {guardians.map((guardian, index) => (
                    <GuardianForm
                      key={index}
                      index={index}
                      guardian={guardian}
                      canRemove={guardians.length > 1}
                      onChange={onGuardianChange}
                      onRemove={onGuardianRemove}
                    />
                  ))}
                </div>
              </>
            );
          }}
        />
      </DataCard>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href={cancelHref}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted",
            pending && "pointer-events-none opacity-50"
          )}
        >
          Cancel
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="md"
          id="submit-student"
          disabled={pending}
          loading={pending}
        >
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ──────────────────────── Local field renderers (form-control styling) ────────────────────────

type ServerErrorsProp = Record<string, string[] | undefined> | undefined;

function EditField({
  label,
  field,
  required,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  serverErrors,
}: {
  label: string;
  field: AnyField;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  serverErrors?: ServerErrorsProp;
}) {
  const err = mergedError(field, serverErrors);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={field.name}>
        {label} {required && <span className="required">*</span>}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={type}
        className={`form-control ${err ? "form-control-error" : ""}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
      />
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

function EditPhone({
  label,
  field,
  serverErrors,
}: {
  label: string;
  field: AnyField;
  serverErrors?: ServerErrorsProp;
}) {
  const err = mergedError(field, serverErrors);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={field.name}>
        {label}
      </label>
      <input
        id={field.name}
        type="tel"
        inputMode="numeric"
        className={`form-control font-mono ${err ? "form-control-error" : ""}`}
        value={formatPhoneInput(field.state.value)}
        onChange={(e) => field.handleChange(stripPhoneFormat(formatPhoneInput(e.target.value)) as never)}
        onBlur={field.handleBlur}
        placeholder="0917-010-0098"
        autoComplete="tel"
      />
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

function EditTextArea({
  label,
  field,
  rows = 2,
  serverErrors,
}: {
  label: string;
  field: AnyField;
  rows?: number;
  serverErrors?: ServerErrorsProp;
}) {
  const err = mergedError(field, serverErrors);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={field.name}>
        {label}
      </label>
      <textarea
        id={field.name}
        name={field.name}
        className={`form-control ${err ? "form-control-error" : ""}`}
        rows={rows}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
      />
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

function EditSelect({
  label,
  field,
  options,
  required,
  serverErrors,
}: {
  label: string;
  field: AnyField;
  options: [string, string][];
  required?: boolean;
  serverErrors?: ServerErrorsProp;
}) {
  const err = mergedError(field, serverErrors);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={field.name}>
        {label} {required && <span className="required">*</span>}
      </label>
      <select
        id={field.name}
        name={field.name}
        className={`form-control ${err ? "form-control-error" : ""}`}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
