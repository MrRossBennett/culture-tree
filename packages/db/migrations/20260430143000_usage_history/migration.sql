CREATE TABLE "usage_history" (
  "id" text PRIMARY KEY NOT NULL,
  "person_id" text NOT NULL,
  "usage_type" text NOT NULL,
  "effective_plan" text NOT NULL,
  "culture_tree_id" text NOT NULL,
  "allowance_period_start" timestamp,
  "allowance_period_end" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "usage_history"
  ADD CONSTRAINT "usage_history_person_id_user_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX "usage_history_person_id_idx" ON "usage_history" USING btree ("person_id");
CREATE INDEX "usage_history_culture_tree_id_idx" ON "usage_history" USING btree ("culture_tree_id");
CREATE INDEX "usage_history_usage_type_idx" ON "usage_history" USING btree ("usage_type");
