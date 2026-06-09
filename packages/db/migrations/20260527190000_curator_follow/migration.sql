CREATE TABLE "curator_follow" (
  "id" text PRIMARY KEY NOT NULL,
  "follower_user_id" text NOT NULL,
  "followed_user_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "curator_follow" ADD CONSTRAINT "curator_follow_follower_user_id_user_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_follow" ADD CONSTRAINT "curator_follow_followed_user_id_user_id_fk" FOREIGN KEY ("followed_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "curator_follow_follower_followed_idx" ON "curator_follow" ("follower_user_id","followed_user_id");
--> statement-breakpoint
CREATE INDEX "curator_follow_follower_user_id_idx" ON "curator_follow" ("follower_user_id");
--> statement-breakpoint
CREATE INDEX "curator_follow_followed_user_id_idx" ON "curator_follow" ("followed_user_id");
