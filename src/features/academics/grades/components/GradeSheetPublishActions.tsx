"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishGradesAction,
  lockGradesAction,
  unlockGradesAction,
} from "../grade-approval.actions";
import type {
  PublishGradeSheetFormState,
  LockGradeSheetFormState,
  UnlockGradeSheetFormState,
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

interface GradeSheetPublishActionsProps {
  gradeSheetId: string;
  status: string;
  canPublish: boolean;
  canLock: boolean;
  canUnlock: boolean;
}

export function GradeSheetPublishActions({
  gradeSheetId,
  status,
  canPublish,
  canLock,
  canUnlock,
}: GradeSheetPublishActionsProps) {
  const router = useRouter();

  // Dialog states
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  // Action states
  const [publishState, setPublishState] = useState<PublishGradeSheetFormState>({});
  const [lockState, setLockState] = useState<LockGradeSheetFormState>({});
  const [unlockState, setUnlockState] = useState<UnlockGradeSheetFormState>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Don't render anything if user has no permissions for any action
  if (!canPublish && !canLock && !canUnlock) {
    return null;
  }

  const handlePublish = async () => {
    const formData = new FormData();
    formData.append("gradeSheetId", gradeSheetId);

    setIsPublishing(true);
    try {
      const result = await publishGradesAction({}, formData);
      setPublishState(result);
      if (result.success) {
        setShowPublishDialog(false);
        // Navigate to Published Grades page to lock the sheet
        router.push("/staff/grades/published");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLock = async () => {
    const formData = new FormData();
    formData.append("gradeSheetId", gradeSheetId);

    setIsLocking(true);
    try {
      const result = await lockGradesAction({}, formData);
      setLockState(result);
      if (result.success) {
        setShowLockDialog(false);
        // Navigate to Locked Grades page
        router.push("/staff/grades/locked");
      }
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockReason.trim()) return;

    const formData = new FormData();
    formData.append("gradeSheetId", gradeSheetId);
    formData.append("reason", unlockReason);

    setIsUnlocking(true);
    try {
      const result = await unlockGradesAction({}, formData);
      setUnlockState(result);
      if (result.success) {
        setShowUnlockDialog(false);
        // Navigate to grades overview (sheet is now draft)
        router.push("/staff/grades");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const isPending = isPublishing || isLocking || isUnlocking;
  const errorMessage = publishState.message || lockState.message || unlockState.message;
  const hasError = errorMessage && !publishState.success && !lockState.success && !unlockState.success;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {status === "principal_approved" && "Publish to Portal"}
        {status === "published" && "Lock Grades"}
        {status === "locked" && "Grade Sheet Actions"}
      </h3>

      {hasError && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-destructive-tint text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {canPublish && (
          <Button
            variant="primary"
            onClick={() => setShowPublishDialog(true)}
            disabled={isPending}
          >
            {isPublishing ? "Publishing..." : "Publish to Student Portal"}
          </Button>
        )}

        {canLock && (
          <Button
            variant="primary"
            onClick={() => setShowLockDialog(true)}
            disabled={isPending}
          >
            {isLocking ? "Locking..." : "Lock Grades (Make Immutable)"}
          </Button>
        )}

        {canUnlock && (
          <Button
            variant="secondary"
            onClick={() => setShowUnlockDialog(true)}
            disabled={isPending}
          >
            {isUnlocking ? "Unlocking..." : "Unlock for Editing"}
          </Button>
        )}
      </div>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Grades to Student Portal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to publish these grades? Students will be able
              to see their grades in the student portal immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock Confirmation Dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Grade Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to lock this grade sheet? Once locked, grades
              cannot be modified unless an administrator unlocks them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLock} disabled={isLocking}>
              {isLocking ? "Locking..." : "Lock Grades"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock Dialog with reason */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock Grade Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking will reset the grade sheet to draft status and require
              re-approval. Please provide a reason for unlocking.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Enter reason for unlocking..."
              className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isUnlocking}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlock}
              disabled={isUnlocking || !unlockReason.trim()}
              className="bg-warning hover:bg-warning text-warning-foreground"
            >
              {isUnlocking ? "Unlocking..." : "Unlock Grade Sheet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
