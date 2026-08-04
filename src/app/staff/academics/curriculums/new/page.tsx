import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { CurriculumForm } from "@/features/academics/curriculums/components/CurriculumForm";

export default async function NewCurriculumPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:create")) {
    redirect("/staff/academics/curriculums");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/staff/academics/curriculums" className="hover:text-primary">
          Curriculums
        </Link>
        <span>/</span>
        <span className="text-foreground">New Curriculum</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create New Curriculum</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start with a draft curriculum. Add subjects, then publish when ready.
        </p>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <CurriculumForm mode="create" />
      </div>
    </div>
  );
}
