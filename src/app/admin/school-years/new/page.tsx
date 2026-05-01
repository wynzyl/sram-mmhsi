import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import SchoolYearForm from "@/components/school-years/SchoolYearForm";

export const metadata: Metadata = {
  title: "Create School Year",
  description: "Create a new school year in SRAMS.",
};

export default async function CreateSchoolYearPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/admin/dashboard");

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create School Year</h1>
          <p className="page-subtitle">Add a new school year to the system</p>
        </div>
        <Link href="/admin/school-years" className="btn-ghost">
          ← Back to School Years
        </Link>
      </div>

      <SchoolYearForm />
    </div>
  );
}
