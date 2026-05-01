DROP INDEX "fee_schedule_unique_idx";--> statement-breakpoint
-- Keep one fee schedule per school year (standard catalog). Drops extra rows and cascading items.
DELETE FROM "fee_schedules"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
      ROW_NUMBER() OVER (PARTITION BY "school_year_id" ORDER BY "created_at" ASC) AS "rn"
    FROM "fee_schedules"
  ) AS "ranked"
  WHERE "rn" > 1
);--> statement-breakpoint
ALTER TABLE "fee_schedules" ALTER COLUMN "grade_level_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "fee_schedules" SET "grade_level_id" = NULL;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD COLUMN "fee_schedule_item_id" uuid;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_schedule_item_id_fee_schedule_items_id_fk" FOREIGN KEY ("fee_schedule_item_id") REFERENCES "public"."fee_schedule_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_schedule_school_year_uidx" ON "fee_schedules" USING btree ("school_year_id");
