"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type RefreshButtonProps = {
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-outline" | "success";
  size?: "sm" | "md" | "lg";
  label?: string;
};

/**
 * Client-side refresh button that invalidates the router cache.
 *
 * Uses `router.refresh()` to:
 * 1. Clear the client-side Router Cache
 * 2. Re-fetch server components with fresh data
 * 3. Update the UI without a full page reload
 *
 * Use this when you need to ensure users see the latest server data,
 * especially after actions performed on other pages.
 */
export function RefreshButton({
  className,
  variant = "secondary",
  size = "sm",
  label = "Refresh",
}: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isPending}
      className={cn("gap-1.5", className)}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      {isPending ? "Refreshing..." : label}
    </Button>
  );
}
