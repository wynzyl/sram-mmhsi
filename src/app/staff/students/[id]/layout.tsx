import { Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

const studentDisplay = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-student-display",
  display: "swap",
});

export default function StaffStudentRecordLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`student-record-root ${studentDisplay.variable}`}>{children}</div>
  );
}
