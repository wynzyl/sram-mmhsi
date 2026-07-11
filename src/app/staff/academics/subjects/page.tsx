import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Info, Lightbulb, BookOpen, Hash } from "lucide-react";
import {
  AddSubjectButton,
  GradeTabsNav,
  SubjectsTable,
} from "@/features/academics";
import {
  getGradeLevelsForDropdown,
  getSubjectsByGradeLevel,
  getSubjectsCountByGradeLevel,
  getTotalSubjectsCount,
} from "@/features/academics/subjects/subjects.queries";
import { requireSession } from "@/lib/auth/session";

interface PageProps {
  searchParams: Promise<{ grade?: string }>;
}

export default async function StaffSubjectManagementPage({
  searchParams,
}: PageProps) {
  await requireSession();

  const params = await searchParams;
  const gradeLevelsList = await getGradeLevelsForDropdown();

  // Default to first grade level if none selected
  const selectedGradeId = params.grade || gradeLevelsList[0]?.id || null;
  const selectedGrade = gradeLevelsList.find((gl) => gl.id === selectedGradeId);

  // Fetch data based on selected grade
  const [subjectsList, subjectsCount, totalCount] = await Promise.all([
    selectedGradeId ? getSubjectsByGradeLevel(selectedGradeId) : Promise.resolve([]),
    selectedGradeId ? getSubjectsCountByGradeLevel(selectedGradeId) : Promise.resolve(0),
    getTotalSubjectsCount(),
  ]);

  return (
    <div className="page-container space-y-6">
      {/* Header Section */}
      <header className="page-header">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <Link href="/staff/academics" className="hover:text-foreground transition-colors">
              Academics
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-primary font-medium">Subject Registry</span>
          </nav>

          {/* Page Title */}
          <h1 className="page-title">
            {selectedGrade?.name || "All"} Subject Registry
          </h1>
        </div>
      </header>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Subjects Card */}
        <div className="stat-card">
          <div className="stat-card-icon">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="stat-card-content">
            <p className="stat-card-label">Total Subjects</p>
            <p className="stat-card-value">{totalCount}</p>
          </div>
        </div>

        {/* Grade Subjects Card */}
        <div className="stat-card">
          <div className="stat-card-icon">
            <Hash className="h-5 w-5 text-primary" />
          </div>
          <div className="stat-card-content">
            <p className="stat-card-label">{selectedGrade?.name || "Selected"} Subjects</p>
            <p className="stat-card-value">{subjectsCount}</p>
          </div>
        </div>

        {/* Promo Card */}
        <div className="promo-card">
          <h3 className="promo-card-title">Curriculum Management</h3>
          <p className="promo-card-text">
            Manage subjects per grade level. Add new subjects or remove existing ones as needed.
          </p>
          <Link href="/staff/academics" className="promo-card-link">
            View Academics
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Grade Tabs + Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Suspense fallback={<div className="pill-tabs animate-pulse h-10 w-64 bg-muted rounded-full" />}>
          <GradeTabsNav
            gradeLevels={gradeLevelsList}
            selectedGradeId={selectedGradeId}
          />
        </Suspense>

        <AddSubjectButton gradeLevels={gradeLevelsList} />
      </div>

      {/* Info Banner */}
      <div className="info-banner">
        <Info className="info-banner-icon" />
        <span className="info-banner-text">
          Currently viewing:{" "}
          <span className="info-banner-emphasis">
            {selectedGrade?.name || "All"} Curriculum
          </span>{" "}
          (DepEd Standard)
        </span>
      </div>

      {/* Subjects Table */}
      <SubjectsTable subjects={subjectsList} />

      {/* Tip Banner */}
      <div className="tip-banner">
        <Lightbulb className="tip-banner-icon" />
        <div className="tip-banner-content">
          <p className="tip-banner-title">Did you know?</p>
          <p className="tip-banner-text">
            You can seed standard DepEd subjects using the command: npm run db:seed-subjects
          </p>
        </div>
      </div>
    </div>
  );
}
