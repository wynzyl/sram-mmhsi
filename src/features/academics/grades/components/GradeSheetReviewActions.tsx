"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  principalApproveAction,
  principalReturnAction,
} from "../grades.actions";
import type {
  ApproveGradeSheetFormState,
  ReturnGradeSheetFormState,
} from "../grades.schema";
import { Button } from "@/components/ui/button";
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

interface GradeSheetReviewActionsProps {
  gradeSheetId: string;
}

export function GradeSheetReviewActions({
  gradeSheetId,
}: GradeSheetReviewActionsProps) {
  const router = useRouter();

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");

  // Action states — tracked manually so messages and pending flags reflect each
  // submission (the useActionState dispatchers were previously bypassed).
  const [approveState, setApproveState] = useState<ApproveGradeSheetFormState>({});
  const [returnState, setReturnState] = useState<ReturnGradeSheetFormState>({});
  const [isApproving, setIsApproving] = useState(false);
  const [isReturning, setIsReturning] = useState(false);

  const handleApprove = async () => {
    const formData = new FormData();
    formData.append("gradeSheetId", gradeSheetId);

    setIsApproving(true);
    try {
      const result = await principalApproveAction({}, formData);
      setApproveState(result);
      if (result.success) {
        setShowApproveDialog(false);
        router.push("/staff/grades/approvals");
        router.refresh();
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleReturn = async () => {
    if (!returnRemarks.trim()) return;

    const formData = new FormData();
    formData.append("gradeSheetId", gradeSheetId);
    formData.append("remarks", returnRemarks);

    setIsReturning(true);
    try {
      const result = await principalReturnAction({}, formData);
      setReturnState(result);
      if (result.success) {
        setShowReturnDialog(false);
        router.push("/staff/grades/approvals");
        router.refresh();
      }
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Review Actions
      </h3>

      {(approveState.message || returnState.message) && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            approveState.success || returnState.success
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
          }`}
        >
          {approveState.message || returnState.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => setShowApproveDialog(true)}
          disabled={isApproving || isReturning}
        >
          {isApproving ? "Approving..." : "Approve Grade Sheet"}
        </Button>

        <Button
          variant="secondary"
          onClick={() => setShowReturnDialog(true)}
          disabled={isApproving || isReturning}
        >
          Return for Revision
        </Button>
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Grade Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this grade sheet? Once approved,
              the grades can be published to students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
              {isApproving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Dialog with remarks */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return for Revision</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks explaining why the grade sheet is being
              returned. The adviser will see these remarks.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <textarea
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="Enter remarks for the adviser..."
              className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isReturning}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReturning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturn}
              disabled={isReturning || !returnRemarks.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isReturning ? "Returning..." : "Return for Revision"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
