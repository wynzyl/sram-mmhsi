import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
