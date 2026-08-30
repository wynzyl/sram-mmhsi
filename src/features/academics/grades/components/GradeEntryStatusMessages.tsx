"use client";

interface StatusMessageProps {
  message: string;
  isSuccess: boolean;
}

/**
 * Status message banner for grade entry operations.
 */
export function GradeEntryStatusMessage({ message, isSuccess }: StatusMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`p-4 border-b ${
        isSuccess
          ? "bg-success/10 text-success border-success/30"
          : "bg-destructive-tint text-destructive border-destructive/25"
      }`}
    >
      {message}
    </div>
  );
}

interface ErrorBannerProps {
  error: string | null;
}

/**
 * Error banner for grade sheet creation errors.
 */
export function GradeEntryErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="p-4 border-b bg-destructive-tint text-destructive border-destructive/25">
      {error}
    </div>
  );
}
