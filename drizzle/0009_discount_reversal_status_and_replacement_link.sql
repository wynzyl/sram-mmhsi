ALTER TYPE "public"."discount_request_status" ADD VALUE 'reversed';--> statement-breakpoint
ALTER TABLE "discount_requests" ADD COLUMN "reversed_at" timestamp;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD COLUMN "replaced_by_request_id" uuid;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_replaced_by_request_id_discount_requests_id_fk" FOREIGN KEY ("replaced_by_request_id") REFERENCES "public"."discount_requests"("id") ON DELETE no action ON UPDATE no action;