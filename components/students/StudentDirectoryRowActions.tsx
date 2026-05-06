import Link from "next/link";
import type { StudentDirectoryBasePath } from "@/lib/utils/student-directory-href";

const iconClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]";

type StaffPortalBase = StudentDirectoryBasePath;

export function StudentDirectoryRowActions({
  studentId,
  studentBasePath = "/admin/students",
}: {
  studentId: string;
  studentBasePath?: StaffPortalBase;
}) {
  const enrollBase =
    studentBasePath === "/staff/students" ? "/staff/enrollments/new" : "/admin/enrollments/new";

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link
        href={`${studentBasePath}/${studentId}`}
        className={iconClass}
        aria-label="View profile"
        title="View profile"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          <path
            fillRule="evenodd"
            d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z"
            clipRule="evenodd"
          />
        </svg>
      </Link>
      <Link
        href={`${studentBasePath}/${studentId}/edit`}
        className={iconClass}
        aria-label="Edit student"
        title="Edit student"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
      </Link>
      <Link
        href={`${enrollBase}?studentId=${studentId}`}
        className={iconClass}
        aria-label="New enrollment"
        title="New enrollment"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
      </Link>
    </div>
  );
}
