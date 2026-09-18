"use client";

import { useState, startTransition, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  deletePeriodAction,
  togglePeriodActiveAction,
} from "../actions";
import type { PeriodView } from "../schedules.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import PeriodFormModal from "./PeriodFormModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
}

interface PeriodsTableProps {
  periods: PeriodView[];
  gradeLevels: GradeLevelOption[];
  activeSchoolYearId: string;
}

export function PeriodsTable({
  periods,
  gradeLevels,
  activeSchoolYearId,
}: PeriodsTableProps) {
  const router = useRouter();
  const [editingPeriod, setEditingPeriod] = useState<PeriodView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState<PeriodView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter periods based on search query
  const filteredPeriods = useMemo(() => {
    if (!searchQuery.trim()) return periods;
    const query = searchQuery.toLowerCase();
    return periods.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.startTime.includes(query) ||
        p.endTime.includes(query)
    );
  }, [periods, searchQuery]);

  // Group periods by gradeLevelId (null = "All Grades")
  const groupedPeriods = useMemo(() => {
    const groups = new Map<string | null, PeriodView[]>();

    for (const period of filteredPeriods) {
      const key = period.gradeLevelId;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(period);
    }

    // Sort groups by grade level order (null/"All Grades" first)
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === null) return -1;
      if (b[0] === null) return 1;
      const orderA = gradeLevels.find((g) => g.id === a[0])?.order ?? 999;
      const orderB = gradeLevels.find((g) => g.id === b[0])?.order ?? 999;
      return orderA - orderB;
    });
  }, [filteredPeriods, gradeLevels]);

  const handleDelete = async () => {
    if (!deletingPeriod) return;
    setIsDeleting(true);
    try {
      const result = await deletePeriodAction(deletingPeriod.id);
      if (result.success) {
        toast.success(result.message);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsDeleting(false);
      setDeletingPeriod(null);
    }
  };

  const handleToggleActive = async (period: PeriodView) => {
    setTogglingId(period.id);
    try {
      const result = await togglePeriodActiveAction(period.id);
      if (result.success) {
        toast.success(result.message);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.message);
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <div className="border border-border rounded-md overflow-hidden">
        {/* Header with count and add button */}
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {periods.length} period{periods.length !== 1 ? "s" : ""}
          </span>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Period
          </Button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-border bg-background">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search periods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Grouped Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Period Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-24">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-32">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedPeriods.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {searchQuery
                      ? "No periods found matching your search."
                      : "No periods configured yet."}
                  </td>
                </tr>
              ) : (
                groupedPeriods.map(([gradeLevelId, groupPeriods]) => (
                  <Fragment key={gradeLevelId ?? "all-grades"}>
                    {/* Grade Level Header Row */}
                    <tr className="bg-muted/30 border-t border-border">
                      <td
                        colSpan={6}
                        className="px-4 py-2.5 font-semibold text-sm"
                      >
                        {gradeLevelId
                          ? gradeLevels.find((g) => g.id === gradeLevelId)
                              ?.name ?? "Unknown Grade"
                          : "All Grades"}
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({groupPeriods.length} period
                          {groupPeriods.length !== 1 ? "s" : ""})
                        </span>
                      </td>
                    </tr>
                    {/* Period Rows */}
                    {groupPeriods.map((period) => (
                      <tr
                        key={period.id}
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {period.periodNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{period.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {period.startTime} - {period.endTime}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={period.isClassPeriod ? "info" : "secondary"}
                          >
                            {period.isClassPeriod ? "Class" : "Break"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={period.isActive ? "success" : "secondary"}
                          >
                            {period.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(period)}
                              disabled={togglingId === period.id}
                              title={period.isActive ? "Deactivate" : "Activate"}
                            >
                              {period.isActive ? (
                                <ToggleRight className="h-4 w-4 text-success" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPeriod(period)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingPeriod(period)}
                              className="text-destructive hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <PeriodFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        gradeLevels={gradeLevels}
        defaultSchoolYearId={activeSchoolYearId}
        onSuccess={() => {
          setShowCreateModal(false);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Edit Modal */}
      {editingPeriod && (
        <PeriodFormModal
          key={editingPeriod.id}
          open={true}
          onOpenChange={(open) => !open && setEditingPeriod(null)}
          period={editingPeriod}
          gradeLevels={gradeLevels}
          defaultSchoolYearId={activeSchoolYearId}
          onSuccess={() => {
            setEditingPeriod(null);
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingPeriod}
        onOpenChange={(open) => !open && setDeletingPeriod(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Period</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingPeriod?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
