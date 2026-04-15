import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

/** Persisted culture tree JSON (validated as CultureTree in app code). */
export const cultureTree = pgTable(
  "culture_tree",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    seedQuery: text("seed_query").notNull(),
    depth: text("depth").notNull(),
    tone: text("tone").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** When true, anyone can view `/tree/$id` without signing in. */
    isPublic: boolean("is_public").default(false).notNull(),
    /** Map of branch node id (e.g. root-0-1) → {@link EnrichedMedia}. */
    enrichmentData: jsonb("enrichment_data"),
  },
  (table) => [index("culture_tree_user_id_idx").on(table.userId)],
);
