"use client";

import { Toaster } from "sonner";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          duration={4000}
          toastOptions={{
            className: "font-sans",
          }}
        />
      </ThemeProvider>
    </QueryProvider>
  );
}
