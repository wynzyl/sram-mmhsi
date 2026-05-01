import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { RootProviders } from "@/components/providers/RootProviders";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SRAMS — School Registration & Accounts Monitoring System",
    template: "%s | SRAMS",
  },
  description:
    "Centralized school operations platform for registration, enrollment, student records, assessment, payments, grades, and management reporting.",
  robots: { index: false, follow: false }, // Internal system — not for indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Apply theme class BEFORE the body paints, to prevent a light/white
            flash on first load and during hard navigations in dark mode.
            Mirrors the logic in ThemeProvider so the React state and DOM agree. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var r=s;if(!s||s==='system'){r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);document.documentElement.style.colorScheme=r;}catch(_){}})();`,
          }}
        />
      </head>
      <body className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
