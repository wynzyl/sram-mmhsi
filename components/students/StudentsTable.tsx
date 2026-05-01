"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-display/DataTable";
import { Badge } from "@/components/ui/badge";

export interface StudentRow {
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  dateOfBirthIso: string | null;
  isActive: boolean;
  createdAtIso: string;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function computeAge(dobIso: string): number {
  const dob = new Date(dobIso);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) {
    return <span className="text-[var(--color-text-muted)] text-sm">—</span>;
  }

  const map: Record<string, { label: string; variant: "success" | "danger" | "info" | "secondary" }> = {
    male:               { label: "M", variant: "info" },
    female:             { label: "F", variant: "danger" },
    other:              { label: "O", variant: "secondary" },
    prefer_not_to_say:  { label: "?", variant: "secondary" },
  };

  const entry = map[gender] ?? { label: gender[0].toUpperCase(), variant: "secondary" as const };

  return (
    <Badge
      variant={entry.variant}
      className="w-7 h-7 rounded-full flex items-center justify-center p-0 text-xs font-bold"
      title={gender.replace(/_/g, " ")}
    >
      {entry.label}
    </Badge>
  );
}

// ── Row actions dropdown ─────────────────────────────────────────────────────

function RowMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)] transition-colors text-lg font-bold leading-none tracking-widest"
      >
        ···
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1 text-sm"
          role="menu"
        >
          <Link
            href={`/admin/students/${id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" aria-hidden="true">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
            </svg>
            View Profile
          </Link>

          <Link
            href={`/admin/students/${id}/edit`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" aria-hidden="true">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
            Edit
          </Link>

          <div className="my-1 border-t border-[var(--color-border)]" />

          <Link
            href={`/admin/enrollments/new?studentId=${id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] transition-colors font-medium"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Enroll
          </Link>
        </div>
      )}
    </div>
  );
}

// ── component ────────────────────────────────────────────────────────────────

interface StudentsTableProps {
  rows: StudentRow[];
}

export function StudentsTable({ rows }: StudentsTableProps) {
  const columns: ColumnDef<StudentRow>[] = [
    {
      id: "referenceNumber",
      header: "Reference No.",
      accessorKey: "referenceNumber",
      cell: ({ row }) => (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tracking-wide">
          {row.original.referenceNumber}
        </span>
      ),
    },
    {
      id: "fullName",
      header: "Name",
      accessorFn: (r) =>
        `${r.lastName}, ${r.firstName}${r.middleName ? ` ${r.middleName[0]}.` : ""}`,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <span className="font-semibold text-[var(--color-text)]">
            {s.lastName}, {s.firstName}
            {s.middleName ? ` ${s.middleName[0]}.` : ""}
          </span>
        );
      },
      sortingFn: "alphanumeric",
    },
    {
      id: "birthdate",
      header: "Birthdate",
      accessorFn: (r) =>
        r.dateOfBirthIso ? new Date(r.dateOfBirthIso).getTime() : -Infinity,
      cell: ({ row }) => {
        const dob = row.original.dateOfBirthIso;
        if (!dob) return <span className="text-[var(--color-text-muted)]">—</span>;
        const age = computeAge(dob);
        const formatted = new Date(dob).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        return (
          <span className="whitespace-nowrap">
            {formatted}{" "}
            <span className="text-[var(--color-text-muted)] text-xs font-normal">
              ({age}y)
            </span>
          </span>
        );
      },
      sortingFn: "basic",
    },
    {
      id: "gender",
      header: "Sex",
      accessorFn: (r) => r.gender ?? "",
      cell: ({ row }) => <GenderBadge gender={row.original.gender} />,
    },
    {
      id: "registered",
      header: "Registered",
      accessorFn: (r) => new Date(r.createdAtIso).getTime(),
      cell: ({ row }) => (
        <span className="text-[var(--color-text-muted)] whitespace-nowrap">
          {new Date(row.original.createdAtIso).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
      sortingFn: "basic",
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => (r.isActive ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "danger"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <RowMenu id={row.original.id} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable={false}
      pageSize={Math.max(rows.length, 1)}
    />
  );
}
