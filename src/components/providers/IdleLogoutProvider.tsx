"use client";

import dynamic from "next/dynamic";

// Dynamically import the idle tracker to avoid SSR/prerendering issues
// The idle tracking logic uses usePathname() which causes prerendering errors
const IdleLogoutTracker = dynamic(
  () => import("./IdleLogoutTracker").then((mod) => mod.IdleLogoutTracker),
  { ssr: false }
);

interface IdleLogoutProviderProps {
  children: React.ReactNode;
}

export function IdleLogoutProvider({ children }: IdleLogoutProviderProps) {
  return (
    <>
      {children}
      <IdleLogoutTracker />
    </>
  );
}
