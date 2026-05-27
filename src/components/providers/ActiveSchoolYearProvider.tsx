"use client";

import { createContext, useContext } from "react";

/**
 * Holds the active school year id on the client so query hooks can decide
 * freshness tiers (current year = always fresh) without each hook fetching
 * it themselves. Seeded once per authenticated layout from the server.
 *
 * Defaults to `null` when no provider is present, which query hooks treat as
 * "unknown" and fall back to fresh — safe, never crashes.
 */
const ActiveSchoolYearContext = createContext<string | null>(null);

export function ActiveSchoolYearProvider({
  activeSchoolYearId,
  children,
}: {
  activeSchoolYearId: string | null;
  children: React.ReactNode;
}) {
  return (
    <ActiveSchoolYearContext.Provider value={activeSchoolYearId}>
      {children}
    </ActiveSchoolYearContext.Provider>
  );
}

/** Returns the active school year id, or `null` if unknown. */
export function useActiveSchoolYearId(): string | null {
  return useContext(ActiveSchoolYearContext);
}
