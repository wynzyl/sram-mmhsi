"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IdleWarningDialogProps {
  open: boolean;
  remainingMs: number;
  onStayLoggedIn: () => void;
}

export function IdleWarningDialog({
  open,
  remainingMs,
  onStayLoggedIn,
}: IdleWarningDialogProps) {
  // Format remaining time for display
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const remainingSeconds = Math.ceil((remainingMs % 60000) / 1000);

  // Display format: "X minutes" or "X seconds" depending on time remaining
  const timeDisplay =
    remainingMinutes > 1
      ? `${remainingMinutes} minutes`
      : remainingSeconds > 0
        ? `${remainingSeconds} seconds`
        : "a moment";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in {timeDisplay} due to inactivity. Click
            the button below to stay logged in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onStayLoggedIn}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
