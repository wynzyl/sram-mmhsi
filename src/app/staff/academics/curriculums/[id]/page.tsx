import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getCurriculumById,
  getCurriculumVersionChain,
  getGradeLevelsForDropdown,
} from "@/features/academics/curriculums";
import { CurriculumStatusBadge } from "@/features/academics/curriculums/components/CurriculumStatusBadge";
import { CurriculumVersionChain } from "@/features/academics/curriculums/components/CurriculumVersionChain";
import { CurriculumDetailClient } from "./CurriculumDetailClient";
import { formatDate } from "@/lib/utils/date";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CurriculumDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:read")) {
    redirect("/staff/dashboard");
  }

  const [curriculum, gradeLevels] = await Promise.all([
    getCurriculumById(id),
    getGradeLevelsForDropdown(),
  ]);

  if (!curriculum) {
    notFound();
  }

  const versionChain = curriculum.rootId
    ? await getCurriculumVersionChain(curriculum.rootId)
    : [];

  // Group subjects by grade level
  const subjectsByGrade = new Map<string, typeof curriculum.subjects>();
  for (const subject of curriculum.subjects) {
    const key = subject.gradeLevelId ?? "unassigned";
    const existing = subjectsByGrade.get(key) ?? [];
    existing.push(subject);
    subjectsByGrade.set(key, existing);
  }

  const groups = Array.from(subjectsByGrade.entries())
    .map(([gradeLevelId, subjects]) => ({
      gradeLevelId,
      gradeLevelName: subjects[0]?.gradeLevelName ?? "Unassigned",
      subjects,
    }))
    .sort((a, b) => {
      // Sort by grade level order (unassigned last)
      if (a.gradeLevelId === "unassigned") return 1;
      if (b.gradeLevelId === "unassigned") return -1;
      return 0;
    });

  // Calculate stats
  const activeSubjects = curriculum.subjects.filter((s) => !s.isDeleted);
  const totalUnits = activeSubjects.reduce(
    (sum, s) => sum + parseFloat(s.units || "0"),
    0
  );
  const coreCount = activeSubjects.filter((s) => s.isCore).length;

  const canEdit = hasPermission(session.role, "curriculums:edit");
  const canPublish = hasPermission(session.role, "curriculums:publish");
  const canArchive = hasPermission(session.role, "curriculums:archive");
  const canManageSubjects = hasPermission(session.role, "subjects:manage");

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/staff/academics/curriculums" className="hover:text-primary">
          Curriculums
        </Link>
        <span>/</span>
        <span className="text-foreground">{curriculum.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{curriculum.name}</h1>
            <CurriculumStatusBadge status={curriculum.status} />
            <span className="font-mono text-sm text-muted-foreground">
              v{curriculum.version}
            </span>
          </div>
          {curriculum.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {curriculum.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {curriculum.status === "draft" && canEdit && (
            <Link
              href={`/staff/academics/curriculums/${id}/edit`}
              className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted"
            >
              Edit Details
            </Link>
          )}
          {curriculum.status === "draft" && canPublish && (
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
            >
              Publish
            </button>
          )}
          {curriculum.status === "published" && canEdit && (
            <Link
              href={`/staff/academics/curriculums/${id}/clone`}
              className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted"
            >
              Clone to Draft
            </Link>
          )}
          {curriculum.status === "published" && canArchive && (
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Version Chain */}
      {versionChain.length > 1 && (
        <CurriculumVersionChain versions={versionChain} currentId={id} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-2xl font-bold tabular-nums">{activeSubjects.length}</p>
          <p className="text-sm text-muted-foreground">Subjects</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-2xl font-bold tabular-nums">{groups.length}</p>
          <p className="text-sm text-muted-foreground">Grade Levels</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-2xl font-bold tabular-nums">{totalUnits.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">Total Units</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-2xl font-bold tabular-nums">{coreCount}</p>
          <p className="text-sm text-muted-foreground">Core Subjects</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-2xl font-bold tabular-nums">{curriculum.adoptions.length}</p>
          <p className="text-sm text-muted-foreground">Adoptions</p>
        </div>
      </div>

      {/* Subjects */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Subjects by Grade Level</h2>
          {curriculum.status === "draft" && canManageSubjects && (
            <span className="text-xs text-muted-foreground">
              Click a grade level to add or manage subjects
            </span>
          )}
        </div>
        <div className="p-4">
          <CurriculumDetailClient
            curriculum={curriculum}
            groups={groups}
            gradeLevels={gradeLevels}
            canManageSubjects={canManageSubjects && curriculum.status === "draft"}
          />
        </div>
      </div>

      {/* Adoptions */}
      {curriculum.adoptions.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Adoptions</h2>
          </div>
          <div className="divide-y divide-border">
            {curriculum.adoptions.map((adoption) => (
              <div key={adoption.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{adoption.gradeLevelName}</span>
                  <span className="text-sm text-muted-foreground">
                    {adoption.schoolYearLabel}
                  </span>
                  {adoption.isActiveYear && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] rounded">
                      Active Year
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  Adopted {formatDate(adoption.adoptedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Created: {formatDate(curriculum.createdAt)} by {curriculum.createdByName ?? "System"}</p>
        {curriculum.publishedAt && (
          <p>Published: {formatDate(curriculum.publishedAt)} by {curriculum.publishedByName ?? "System"}</p>
        )}
        {curriculum.archivedAt && (
          <p>Archived: {formatDate(curriculum.archivedAt)} by {curriculum.archivedByName ?? "System"}</p>
        )}
      </div>
    </div>
  );
}
