"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/errors/client-reporting";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to monitoring
    reportClientError(error, { source: "portal" });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-950 p-4">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-destructive"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        <h2 className="mb-2 font-display text-xl font-bold text-foreground">
          Something went wrong to the portal
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Please contact the administrator. Please try again.
        </p>

        {error.digest && (
          <p className="mb-4 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} size="sm">
            Try again
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (window.location.href = "/portal/dashboard")}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
