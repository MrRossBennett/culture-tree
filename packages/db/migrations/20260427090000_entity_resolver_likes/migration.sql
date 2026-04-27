CREATE TABLE "entity" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"image_url" text,
	"description" text,
	"primary_external_source" text NOT NULL,
	"primary_external_type" text NOT NULL,
	"primary_external_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_external_identity" (
	"id" text PRIMARY KEY,
	"entity_id" text NOT NULL,
	"source" text NOT NULL,
	"external_type" text NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tree_item_entity" (
	"id" text PRIMARY KEY,
	"tree_id" text NOT NULL,
	"item_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_resolution_job" (
	"id" text PRIMARY KEY,
	"tree_id" text NOT NULL,
	"item_id" text NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_like" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_external_identity" ADD CONSTRAINT "entity_external_identity_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_item_entity" ADD CONSTRAINT "tree_item_entity_tree_id_culture_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."culture_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_item_entity" ADD CONSTRAINT "tree_item_entity_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_resolution_job" ADD CONSTRAINT "entity_resolution_job_tree_id_culture_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."culture_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_like" ADD CONSTRAINT "entity_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_like" ADD CONSTRAINT "entity_like_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_primary_external_identity_idx" ON "entity" ("primary_external_source","primary_external_type","primary_external_id");--> statement-breakpoint
CREATE INDEX "entity_type_idx" ON "entity" ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_external_identity_source_type_id_idx" ON "entity_external_identity" ("source","external_type","external_id");--> statement-breakpoint
CREATE INDEX "entity_external_identity_entity_id_idx" ON "entity_external_identity" ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tree_item_entity_tree_item_idx" ON "tree_item_entity" ("tree_id","item_id");--> statement-breakpoint
CREATE INDEX "tree_item_entity_entity_id_idx" ON "tree_item_entity" ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_resolution_job_tree_item_idx" ON "entity_resolution_job" ("tree_id","item_id");--> statement-breakpoint
CREATE INDEX "entity_resolution_job_status_scheduled_idx" ON "entity_resolution_job" ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_like_user_entity_idx" ON "entity_like" ("user_id","entity_id");--> statement-breakpoint
CREATE INDEX "entity_like_entity_id_idx" ON "entity_like" ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_like_user_id_idx" ON "entity_like" ("user_id");
