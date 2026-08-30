import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Page not found" };

/**
 * Portal-scoped 404. Renders inside the portal shell so a student or parent
 * keeps their navigation instead of being dropped onto the app-wide page.
 */
export default function PortalNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <FileQuestion
        className="h-12 w-12 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mt-4 font-serif text-2xl font-bold italic tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        The page you are looking for does not exist or is no longer available.
      </p>
      <Link
        href="/portal/dashboard"
        className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-6")}
      >
        Back to dashboard
      </Link>
    </main>
  );
}
