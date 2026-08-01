import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAllStrands,
  StrandsTable,
} from "@/features/academics/strands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, CheckCircle2 } from "lucide-react";
import { AddStrandButton } from "./AddStrandButton";

export const metadata = {
  title: "Strands Management | SRAMS",
  description: "Manage SHS academic strands",
};

export default async function StrandsPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:read")) {
    redirect("/staff/dashboard");
  }

  const strands = await getAllStrands();
  const canManage = hasPermission(session.role, "strands:manage");

  const activeStrands = strands.filter((s) => s.isActive);
  const academicStrands = strands.filter((s) => !s.code.startsWith("TVL-"));
  const tvlStrands = strands.filter((s) => s.code.startsWith("TVL-"));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SHS Strands</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Senior High School academic strands and specializations
          </p>
        </div>
        {canManage && <AddStrandButton />}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{strands.length}</div>
              <div className="text-sm text-muted-foreground">Total Strands</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-success/10 p-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeStrands.length}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-500/10 p-3">
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{academicStrands.length}</div>
              <div className="text-sm text-muted-foreground">Academic Track</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-orange-500/10 p-3">
              <GraduationCap className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{tvlStrands.length}</div>
              <div className="text-sm text-muted-foreground">TVL Track</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strands Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            All Strands
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <StrandsTable strands={strands} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
