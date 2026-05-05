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
            Series line must match the printed range (e.g. AK 00051-00100), prefix, and exactly 50 OR numbers.
          </p>
        </div>
      </div>

      <BookletForm />
    </div>
  );
}
