import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import StudentForm from "@/components/students/StudentForm";

export const metadata: Metadata = {
  title: "Register New Student",
};

export default async function NewStudentPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) redirect("/admin/students");

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Register New Student</h1>
          <p className="page-subtitle">
            Create the student master record. Enroll for a school year from Enrollments after this
            step.
          </p>
        </div>
      </div>

      <StudentForm />
    </div>
  );
}
