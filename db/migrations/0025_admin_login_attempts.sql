CREATE TABLE "admin_login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_admin_login_attempts_ip_created" ON "admin_login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_login_attempts_created" ON "admin_login_attempts" USING btree ("created_at");