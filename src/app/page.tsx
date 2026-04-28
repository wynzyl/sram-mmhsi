import { redirect } from "next/navigation";

/**
 * Root page — redirect to the login page.
 * Authenticated users are redirected by middleware to their role dashboard.
 */
export default function RootPage() {
  redirect("/login");
}
