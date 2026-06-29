"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Kebab actions for a student row — used on Students and Registrations lists */
export function StudentRowActionsMenu({
  studentId,
  studentBasePath = "/staff/students",
}: {
  studentId: string;
  studentBasePath?: "/admin/students" | "/staff/students";
}) {
  const enrollBase =
    studentBasePath.startsWith("/admin")
      ? "/admin/enrollments/new"
      : "/staff/enrollments/new";
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
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-gray-200 hover:text-foreground transition-colors text-lg font-bold leading-none tracking-widest dark:hover:bg-gray-800"
      >
        ···
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg py-1 text-sm"
          role="menu"
        >
          <Link
            href={`${studentBasePath}/${studentId}`}
            prefetch={false}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-foreground hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
            </svg>
            View Profile
          </Link>

          <Link
            href={`${studentBasePath}/${studentId}/edit`}
            prefetch={false}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-foreground hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
            Edit
          </Link>

          <div className="my-1 border-t border-border" />

          <Link
            href={`${enrollBase}?studentId=${studentId}`}
            prefetch={false}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-primary hover:bg-primary/10 transition-colors font-medium"
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
