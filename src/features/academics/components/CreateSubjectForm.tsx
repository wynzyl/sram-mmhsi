"use client";

import { useActionState } from "react";
import { createSubjectAction } from "../subjects/subjects.actions";
import { FormStateAlert } from "@/components/forms/FormStateAlert";

export default function CreateSubjectForm({
  gradeLevels,
}: {
  gradeLevels: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createSubjectAction, {});

  return (
    <form action={formAction} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Subject</h3>

      <FormStateAlert state={state} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g. Mathematics"
          />
          {state.errors?.name && <p className="mt-1 text-sm text-red-600">{state.errors.name.join(", ")}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
          <input
            type="text"
            name="code"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g. MATH7"
          />
          {state.errors?.code && <p className="mt-1 text-sm text-red-600">{state.errors.code.join(", ")}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
          <select
            name="gradeLevelId"
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Grade Level</option>
            {gradeLevels.map((gl) => (
              <option key={gl.id} value={gl.id}>{gl.name}</option>
            ))}
          </select>
          {state.errors?.gradeLevelId && <p className="mt-1 text-sm text-red-600">{state.errors.gradeLevelId.join(", ")}</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Subject"}
        </button>
      </div>
    </form>
  );
}
