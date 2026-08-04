import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCurriculumById } from "@/features/academics/curriculums";
import { CurriculumForm } from "@/features/academics/curriculums/components/CurriculumForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCurriculumPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:edit")) {
    redirect("/staff/academics/curriculums");
  }

  const curriculum = await getCurriculumById(id);

  if (!curriculum) {
    notFound();
  }

  if (curriculum.status !== "draft") {
    redirect(`/staff/academics/curriculums/${id}`);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/staff/academics/curriculums" className="hover:text-primary">
          Curriculums
        </Link>
        <span>/</span>
        <Link
          href={`/staff/academics/curriculums/${id}`}
          className="hover:text-primary"
        >
          {curriculum.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Edit Curriculum</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update the curriculum name and description.
        </p>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <CurriculumForm
          mode="edit"
          curriculum={{
            id: curriculum.id,
            name: curriculum.name,
            description: curriculum.description,
          }}
        />
      </div>
    </div>
  );
}
