"use client";

import { usePathname } from "next/navigation";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { IdleWarningDialog } from "@/features/auth/components/IdleWarningDialog";

// Routes where idle tracking should be disabled (public routes)
const PUBLIC_ROUTES = ["/login", "/change-password"];

export function IdleLogoutTracker() {
  const pathname = usePathname();

  // Disable idle tracking on public routes
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  const { showWarning, remainingMs, resetTimer } = useIdleLogout({
    enabled: !isPublicRoute,
  });

  return (
    <IdleWarningDialog
      open={showWarning}
      remainingMs={remainingMs}
      onStayLoggedIn={resetTimer}
    />
  );
}
