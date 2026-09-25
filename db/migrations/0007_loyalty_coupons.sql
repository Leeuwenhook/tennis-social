CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"discount_percent" integer DEFAULT 50 NOT NULL,
	"milestone_count" integer NOT NULL,
	"issued_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"reserved_booking_id" text,
	"redeemed_booking_id" text,
	"redeemed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coupon_id" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coupon_discount_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_bookings_user_status" ON "bookings" USING btree ("user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_user_milestone_unique" ON "coupons" USING btree ("user_id","milestone_count");
--> statement-breakpoint
CREATE INDEX "idx_coupons_user_status_expiry" ON "coupons" USING btree ("user_id","status","expires_at");
