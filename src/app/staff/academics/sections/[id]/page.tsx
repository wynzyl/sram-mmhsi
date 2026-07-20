import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getSectionById,
  getStudentsInSection,
  SectionStudentsTable,
} from "@/features/academics/sections";
import { getAdviserForSection } from "@/features/academics/advisers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, BookOpen, Calendar, UserCheck } from "lucide-react";

interface SectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SectionDetailPageProps) {
  const { id } = await params;
  const section = await getSectionById(id);

  if (!section) {
    return { title: "Section Not Found | SRAMS" };
  }

  return {
    title: `${section.name} - ${section.gradeLevelName} | SRAMS`,
    description: `View section details and enrolled students for ${section.name}`,
  };
}

export default async function SectionDetailPage({
  params,
}: SectionDetailPageProps) {
  const session = await requireSession();
  const { id } = await params;

  if (!hasPermission(session.role, "sections:manage")) {
    redirect("/staff/dashboard");
  }

  const section = await getSectionById(id);

  if (!section) {
    notFound();
  }

  const [students, adviser] = await Promise.all([
    getStudentsInSection(id),
    getAdviserForSection(id, section.schoolYearId),
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/staff/academics/sections">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sections
          </Button>
        </Link>
      </div>

      {/* Section Info */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {section.name}
            </h1>
            {section.isActiveYear && (
              <Badge variant="success">Active Year</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {section.gradeLevelName} &bull; {section.schoolYearLabel}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{students.length}</div>
              <div className="text-sm text-muted-foreground">
                Enrolled Students
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-500/10 p-3">
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{section.assignmentCount}</div>
              <div className="text-sm text-muted-foreground">
                Teacher Assignments
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-500/10 p-3">
              <UserCheck className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <div className="text-lg font-semibold truncate">
                {adviser ? adviser.userName : "Not Assigned"}
              </div>
              <div className="text-sm text-muted-foreground">
                Section Adviser
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-500/10 p-3">
              <Calendar className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{section.schoolYearLabel}</div>
              <div className="text-sm text-muted-foreground">School Year</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enrolled Students
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SectionStudentsTable students={students} />
        </CardContent>
      </Card>
    </div>
  );
}
