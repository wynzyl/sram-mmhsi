import type { Metadata } from "next";
import localFont from "next/font/local";
import { Merriweather, Inter, JetBrains_Mono } from "next/font/google";
import { RootProviders } from "@/components/providers/RootProviders";
import "./globals.css";

const crimsonPro = localFont({
  variable: "--font-crimson",
  display: "swap",
  src: [
    { path: "../../public/fonts/CrimsonPro-Variable.woff2", weight: "600 900", style: "normal" },
  ],
});

const ibmPlexSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../public/fonts/IBMPlexSans-Variable.woff2", weight: "300 700", style: "normal" },
  ],
});

const ibmPlexMono = localFont({
  variable: "--font-ibm-mono",
  display: "swap",
  src: [
    { path: "../../public/fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/IBMPlexMono-600.woff2", weight: "600", style: "normal" },
  ],
});

const merriweather = Merriweather({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
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
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('theme');var r=m;if(!m||m==='system'){r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var c=localStorage.getItem('colorTheme');var root=document.documentElement;root.classList.remove('light','dark','theme-cosmic','theme-slate','theme-graphite');root.classList.add(r);root.style.colorScheme=r;if(c&&c!=='default'){root.classList.add('theme-'+c);}root.classList.add('hydrated');}catch(_){}})();",
          }}
        />
      </head>
      <body
        className={`${crimsonPro.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${merriweather.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      >
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
