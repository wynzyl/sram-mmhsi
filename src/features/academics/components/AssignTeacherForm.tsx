"use client";

import { useActionState, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { assignTeacherAction } from "../teacher-assignments/teacher-assignments.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";

export default function AssignTeacherForm({
  teachers,
  subjects,
  sections,
  schoolYears,
}: {
  teachers: { id: string; username: string; email: string }[];
  subjects: { id: string; name: string; code: string; gradeLevelId?: string }[];
  sections: { id: string; name: string; gradeLevelId?: string }[];
  schoolYears: { id: string; label: string; isActive: boolean }[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(assignTeacherAction, {});
  const [selectedSectionId, setSelectedSectionId] = useState("");

  useFormToast(state, {
    successMessage: "Teacher assigned successfully",
    onSuccess: () => router.refresh(),
  });

  // Get the selected section's grade level
  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const selectedGradeLevelId = selectedSection?.gradeLevelId;

  // Filter subjects by the selected section's grade level
  const filteredSubjects = useMemo(() => {
    if (!selectedGradeLevelId) {
      return []; // No section selected, show no subjects
    }
    return subjects.filter((s) => s.gradeLevelId === selectedGradeLevelId);
  }, [subjects, selectedGradeLevelId]);

  return (
    <form action={formAction} className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground mb-4">Assign Teacher</h3>

      {/* Form-level errors are shown via useFormToast, field errors stay inline */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Teacher</label>
          <select
            name="teacherId"
            required
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select Teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.username} ({t.email})</option>
            ))}
          </select>
          {state.errors?.teacherId && (
            <p className="text-sm text-destructive">{state.errors.teacherId.join(", ")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Section</label>
          <select
            name="sectionId"
            required
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {state.errors?.sectionId && (
            <p className="text-sm text-destructive">{state.errors.sectionId.join(", ")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Subject</label>
          <select
            name="subjectId"
            required
            disabled={!selectedSectionId}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            <option value="">
              {selectedSectionId ? "Select Subject" : "Select a section first"}
            </option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
          {state.errors?.subjectId && (
            <p className="text-sm text-destructive">{state.errors.subjectId.join(", ")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">School Year</label>
          <select
            name="schoolYearId"
            required
            defaultValue={schoolYears.find(sy => sy.isActive)?.id || ""}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select School Year</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>{sy.label} {sy.isActive ? "(Active)" : ""}</option>
            ))}
          </select>
          {state.errors?.schoolYearId && (
            <p className="text-sm text-destructive">{state.errors.schoolYearId.join(", ")}</p>
          )}
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" variant="primary" loading={isPending}>
          Assign Teacher
        </Button>
      </div>
    </form>
  );
}
