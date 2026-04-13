CREATE TABLE "enrichment_cache" (
	"id" text PRIMARY KEY,
	"search_hint_hash" text NOT NULL UNIQUE,
	"node_type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "culture_tree" ADD COLUMN "enrichment_data" jsonb;--> statement-breakpoint
CREATE INDEX "enrichment_cache_expires_at_idx" ON "enrichment_cache" ("expires_at");