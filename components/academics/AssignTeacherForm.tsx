"use client";

import { useActionState } from "react";
import { assignTeacherAction } from "@/actions/academics";

export function AssignTeacherForm({
  teachers,
  subjects,
  sections,
  schoolYears,
}: {
  teachers: { id: string; username: string; email: string }[];
  subjects: { id: string; name: string; code: string }[];
  sections: { id: string; name: string }[];
  schoolYears: { id: string; label: string; isActive: boolean }[];
}) {
  const [state, formAction, isPending] = useActionState(assignTeacherAction, {});

  return (
    <form action={formAction} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Teacher</h3>

      {state.message && (
        <div className={`p-4 mb-4 rounded-md text-sm ${state.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {state.message}
        </div>
      )}

      {state.errors?._form && (
        <div className="p-4 mb-4 bg-red-50 text-red-800 rounded-md text-sm">
          {state.errors._form.join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
          <select
            name="teacherId"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.username} ({t.email})</option>
            ))}
          </select>
          {state.errors?.teacherId && <p className="mt-1 text-sm text-red-600">{state.errors.teacherId.join(", ")}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select
            name="subjectId"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
          {state.errors?.subjectId && <p className="mt-1 text-sm text-red-600">{state.errors.subjectId.join(", ")}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
          <select
            name="sectionId"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {state.errors?.sectionId && <p className="mt-1 text-sm text-red-600">{state.errors.sectionId.join(", ")}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
          <select
            name="schoolYearId"
            required
            defaultValue={schoolYears.find(sy => sy.isActive)?.id || ""}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select School Year</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>{sy.label} {sy.isActive ? "(Active)" : ""}</option>
            ))}
          </select>
          {state.errors?.schoolYearId && <p className="mt-1 text-sm text-red-600">{state.errors.schoolYearId.join(", ")}</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Assigning..." : "Assign Teacher"}
        </button>
      </div>
    </form>
  );
}
