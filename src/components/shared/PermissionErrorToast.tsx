"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Error code to message mapping for permission-related redirects.
 * Add new error codes here as needed.
 */
const ERROR_MESSAGES: Record<string, string> = {
  no_permission: "You do not have permission to access this resource",
};

/**
 * Global client component that checks for permission errors in URL and displays a toast.
 * Clears the error param from URL after showing the toast.
 *
 * Usage: Add `?error=no_permission` (or other error codes) to redirect URLs
 * when a user lacks permission to access a resource.
 */
export function PermissionErrorToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const error = searchParams.get("error");

    if (error && ERROR_MESSAGES[error]) {
      toast.error(ERROR_MESSAGES[error]);

      // Remove the error param from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  return null;
}
