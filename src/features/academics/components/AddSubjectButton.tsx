"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import CreateSubjectForm from "./CreateSubjectForm";

interface AddSubjectButtonProps {
  gradeLevels: { id: string; name: string }[];
}

/**
 * Button that opens a modal to add a new subject
 */
export default function AddSubjectButton({ gradeLevels }: AddSubjectButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    setShowForm(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add New Subject
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg mx-4 animate-fade-up">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Add New Subject</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4">
              <CreateSubjectForm gradeLevels={gradeLevels} onSuccess={handleSuccess} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
