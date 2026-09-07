import { StudentLedgersPage } from "@/app/page-templates/student-ledgers/student-ledgers-page";

// Disable instant navigation - page has session/DB access
export const instant = false;

export default function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <StudentLedgersPage searchParams={props.searchParams} />;
}
