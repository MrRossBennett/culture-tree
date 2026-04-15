ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bio" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_unique" ON "user" ("username");
