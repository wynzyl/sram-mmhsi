import { redirect } from "next/navigation";

// The "Create Template" flow is now a modal on the Fee Templates list page.
export default function NewFeeTemplatePage() {
  redirect("/staff/finance/fee-templates");
}
