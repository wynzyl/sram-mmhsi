import localFont from "next/font/local";
import type { ReactNode } from "react";

const studentDisplay = localFont({
  variable: "--font-student-display",
  display: "swap",
  src: [
    { path: "../../../../../public/fonts/SourceSerif4-Variable.woff2", weight: "400 700", style: "normal" },
  ],
});

export default function StaffStudentRecordLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`student-record-root ${studentDisplay.variable}`}>{children}</div>
  );
}
