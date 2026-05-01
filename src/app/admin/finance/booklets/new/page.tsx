import type { Metadata } from "next";
import BookletForm from "@/components/finance/BookletForm";

export const metadata: Metadata = {
  title: "Register Receipt Booklet",
};

export default function NewBookletPage() {
  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Register OR Booklet</h1>
          <p className="page-subtitle">
            Define booklet range, internal series label, and the printed OR prefix (e.g. AP 00050).
          </p>
        </div>
      </div>

      <BookletForm />
    </div>
  );
}
