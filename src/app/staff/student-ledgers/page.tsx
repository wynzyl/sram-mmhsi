import { StudentLedgersPage } from "@/app/page-templates/student-ledgers/student-ledgers-page";

export default function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <StudentLedgersPage searchParams={props.searchParams} />;
}
