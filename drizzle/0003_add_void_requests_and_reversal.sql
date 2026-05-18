CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."void_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'reversed';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'reversal';--> statement-breakpoint
CREATE TABLE "void_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"request_reason" text NOT NULL,
	"status" "void_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp,
	"decision_remarks" text,
	"cancelled_at" timestamp,
	"reversal_payment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "payments_or_number_idx";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "booklet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "or_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "kind" "payment_kind" DEFAULT 'payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reverses_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_by_request_id" uuid;--> statement-breakpoint
ALTER TABLE "void_requests" ADD CONSTRAINT "void_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "void_requests" ADD CONSTRAINT "void_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "void_requests_payment_pending_uidx" ON "void_requests" USING btree ("payment_id") WHERE "void_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "void_requests_status_idx" ON "void_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "void_requests_payment_idx" ON "void_requests" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "void_requests_requested_by_idx" ON "void_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "void_requests_pending_status_idx" ON "void_requests" USING btree ("status") WHERE "void_requests"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reverses_payment_id_payments_id_fk" FOREIGN KEY ("reverses_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_reverses_payment_idx" ON "payments" USING btree ("reverses_payment_id");--> statement-breakpoint
CREATE INDEX "payments_kind_idx" ON "payments" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_or_number_idx" ON "payments" USING btree ("or_number") WHERE "payments"."or_number" IS NOT NULL;