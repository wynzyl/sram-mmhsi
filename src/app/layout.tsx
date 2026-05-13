import type { Metadata } from "next";
import { Crimson_Pro, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { RootProviders } from "@/components/providers/RootProviders";
import "./globals.css";
import "./ledger-register.css";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
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
      <body
        className={`${crimsonPro.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      >
        {/* Theme initialization script - runs before page hydration to prevent flash */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var r=s;if(!s||s==='system'){r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);document.documentElement.style.colorScheme=r;}catch(_){}})();`,
          }}
        />
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
