ALTER TABLE "assessments" DROP CONSTRAINT "assessments_transferred_to_assessment_id_assessments_id_fk";
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_transfer_fields_atomic" CHECK (
          ((
            "assessments"."transferred_at" IS NULL AND
            "assessments"."transferred_by" IS NULL AND
            "assessments"."transferred_to_assessment_id" IS NULL
          ) OR (
    sourceAssessmentId: uuid("source_assessment_id").references(() => assessments.id, { onDelete: "restrict" }),            "assessments"."transferred_by" IS NOT NULL AND
            "assessments"."transferred_to_assessment_id" IS NOT NULL
          )));--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_no_retransfer" CHECK (
          ("assessments"."transferred_at" IS NULL) OR (
            "assessments"."transferred_at" IS NOT NULL AND
            OLD.transferredAt IS NULL
          ));