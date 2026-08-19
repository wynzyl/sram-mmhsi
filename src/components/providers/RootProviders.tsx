"use client";

import { Toaster } from "sonner";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { IdleLogoutProvider } from "./IdleLogoutProvider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <IdleLogoutProvider>
          {children}
        </IdleLogoutProvider>
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
