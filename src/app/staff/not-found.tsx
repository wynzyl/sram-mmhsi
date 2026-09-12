"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Staff-scoped 404. Renders inside the staff shell so authenticated users
 * keep their navigation instead of being dropped onto the app-wide page.
 */
export default function StaffNotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <FileQuestion
              className="h-10 w-10 text-muted-foreground"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
        </div>

        <h2 className="mb-2 font-display text-xl font-bold text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The page you are looking for does not exist or is no longer available.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="sm" onClick={() => router.back()}>
            Go back
          </Button>
          <Link
            href="/staff/dashboard"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
