CREATE TABLE "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_zh" text NOT NULL,
	"area" text NOT NULL,
	"area_zh" text NOT NULL,
	"photo" text NOT NULL,
	"peak_price_pence" integer NOT NULL,
	"off_peak_price_pence" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
