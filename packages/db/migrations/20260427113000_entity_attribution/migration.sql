ALTER TABLE "entity" ADD COLUMN "creator_name" text;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "creator_role" text;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "disambiguation" text;--> statement-breakpoint
UPDATE "entity"
SET
  "name" = NULLIF("metadata" #>> '{searchHint,title}', ''),
  "creator_name" = NULLIF("metadata" #>> '{searchHint,creator}', ''),
  "creator_role" = CASE
    WHEN "type" = 'book' THEN 'author'
    WHEN "type" IN ('album', 'song') THEN 'artist'
    WHEN "type" IN ('film', 'tv') THEN 'director'
    WHEN "type" = 'artwork' THEN 'artist'
    WHEN "type" = 'article' THEN 'author'
    WHEN "type" = 'podcast' THEN 'creator'
    ELSE NULL
  END,
  "disambiguation" = CASE
    WHEN "year" IS NOT NULL THEN "year"::text || ' ' || "type"
    ELSE "type"
  END
WHERE
  "metadata" #>> '{searchHint,title}' IS NOT NULL
  AND "type" IN ('book', 'album', 'song', 'film', 'tv', 'artwork', 'article', 'podcast')
  AND NULLIF("metadata" #>> '{searchHint,title}', '') IS NOT NULL;
