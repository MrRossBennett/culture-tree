import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** API response cache keyed by hash(nodeType + searchHint). */
export const enrichmentCache = pgTable(
  "enrichment_cache",
  {
    id: text("id").primaryKey(),
    searchHintHash: text("search_hint_hash").notNull().unique(),
    nodeType: text("node_type").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("enrichment_cache_expires_at_idx").on(table.expiresAt)],
);
