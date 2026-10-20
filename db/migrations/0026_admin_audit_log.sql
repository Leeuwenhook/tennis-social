CREATE TABLE "admin_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"before_json" text,
	"after_json" text,
	"undone_at" text,
	"undone_by" text
);
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_target" ON "admin_audit_log" USING btree ("target_type","target_id","created_at");