import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Register Student",
  description: "Choose how to register or enroll a learner.",
};

export default function StaffRegisterRedirectPage() {
  redirect("/staff/students/new");
}
