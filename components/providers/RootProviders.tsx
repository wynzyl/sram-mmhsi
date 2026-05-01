"use client";

import { ThemeProvider } from "./ThemeProvider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
