import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCurriculumById } from "@/features/academics/curriculums";
import { generateDraftName, getNextVersion } from "@/features/academics/curriculums";
import { CurriculumStatusBadge } from "@/features/academics/curriculums/components/CurriculumStatusBadge";
import { CloneCurriculumForm } from "@/features/academics/curriculums/components/CloneCurriculumForm";
import { db } from "@/lib/db";
import { curriculums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CloneCurriculumPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:edit")) {
    redirect("/staff/academics/curriculums");
  }

  const curriculum = await getCurriculumById(id);

  if (!curriculum) {
    notFound();
  }

  // Cannot clone a draft curriculum
  if (curriculum.status === "draft") {
    redirect(`/staff/academics/curriculums/${id}`);
  }

  // Get version chain to determine next version number
  const chainVersions = await db
    .select({ version: curriculums.version })
    .from(curriculums)
    .where(eq(curriculums.rootId, curriculum.rootId ?? curriculum.id));

  const nextVersion = getNextVersion(chainVersions.map((c) => c.version));
  const suggestedName = generateDraftName(curriculum.name, nextVersion);

  // Group subjects by grade level for preview
  const subjectsByGrade = new Map<string, { name: string; count: number }>();
  const activeSubjects = curriculum.subjects.filter((s) => !s.isDeleted);

  for (const subject of activeSubjects) {
    const key = subject.gradeLevelId ?? "unassigned";
    const existing = subjectsByGrade.get(key);
    if (existing) {
      existing.count++;
    } else {
      subjectsByGrade.set(key, {
        name: subject.gradeLevelName ?? "Unassigned",
        count: 1,
      });
    }
  }

  const gradeLevelSummary = Array.from(subjectsByGrade.entries())
    .map(([gradeLevelId, data]) => ({
      gradeLevelId,
      gradeLevelName: data.name,
      subjectCount: data.count,
    }))
    .sort((a, b) => a.gradeLevelName.localeCompare(b.gradeLevelName));

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
        <span className="text-foreground">Clone to Draft</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Clone Curriculum</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new draft version based on an existing curriculum. All subjects will be copied.
        </p>
      </div>

      {/* Source Curriculum Info */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
        <p className="text-sm text-muted-foreground mb-2">Source Curriculum</p>
        <div className="flex items-center gap-3">
          <span className="font-medium">{curriculum.name}</span>
          <CurriculumStatusBadge status={curriculum.status} />
          <span className="font-mono text-sm text-muted-foreground">
            v{curriculum.version}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {activeSubjects.length} subject{activeSubjects.length !== 1 ? "s" : ""}
          </span>
          <span>•</span>
          <span>
            {gradeLevelSummary.length} grade level{gradeLevelSummary.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <CloneCurriculumForm
          sourceCurriculumId={id}
          sourceCurriculumName={curriculum.name}
          suggestedName={suggestedName}
          gradeLevelSummary={gradeLevelSummary}
        />
      </div>
    </div>
  );
}
