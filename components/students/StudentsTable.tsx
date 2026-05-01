"use client";

import Link from "next/link";
import { useMemo } from "react";
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

/** Circular gender badge — letter only, colour-coded to the app theme */
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

// ── component ────────────────────────────────────────────────────────────────

interface StudentsTableProps {
  rows: StudentRow[];
}

export function StudentsTable({ rows }: StudentsTableProps) {
  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        id: "referenceNumber",
        header: "Reference No.",
        accessorKey: "referenceNumber",
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tracking-wide pl-2">
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
        cell: ({ row }) => (
          <Link
            href={`/admin/students/${row.original.id}`}
            id={`view-student-${row.original.id}`}
            title="View student profile"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)] transition-colors text-base font-bold tracking-widest leading-none"
          >
            ···
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable={false}
      pageSize={Math.max(rows.length, 1)}
    />
  );
}
