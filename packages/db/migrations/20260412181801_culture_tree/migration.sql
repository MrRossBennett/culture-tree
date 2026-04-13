CREATE TABLE "culture_tree" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"seed_query" text NOT NULL,
	"depth" text NOT NULL,
	"tone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "culture_tree_user_id_idx" ON "culture_tree" ("user_id");--> statement-breakpoint
ALTER TABLE "culture_tree" ADD CONSTRAINT "culture_tree_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;