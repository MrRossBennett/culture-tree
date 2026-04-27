ALTER TABLE "culture_tree" ADD COLUMN "media_filter" jsonb;
ALTER TABLE "culture_tree" ADD COLUMN "generation_status" text DEFAULT 'ready' NOT NULL;
ALTER TABLE "culture_tree" ADD COLUMN "generation_run_id" text;
ALTER TABLE "culture_tree" ADD COLUMN "generation_stage" text;
ALTER TABLE "culture_tree" ADD COLUMN "generation_updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "culture_tree" ADD COLUMN "generation_error" text;
ALTER TABLE "culture_tree" ADD COLUMN "generation_final_data" jsonb;
