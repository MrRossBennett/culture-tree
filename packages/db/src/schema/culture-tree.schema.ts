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
    /** Map of tree item id (e.g. item_001) → {@link EnrichedMedia}. */
    enrichmentData: jsonb("enrichment_data"),
    /** Optional media category filter used when generating or retrying this tree. */
    mediaFilter: jsonb("media_filter"),
    /** Durable generation lifecycle state for progressive tree generation. */
    generationStatus: text("generation_status").default("ready").notNull(),
    /** Fences writes so stale generation workers cannot overwrite a newer run. */
    generationRunId: text("generation_run_id"),
    /** Human-readable stage shown while generation is active. */
    generationStage: text("generation_stage"),
    /** Last generation progress update, used to recover stale runs. */
    generationUpdatedAt: timestamp("generation_updated_at").defaultNow().notNull(),
    /** Recoverable failure message for stopped drafts. */
    generationError: text("generation_error"),
    /** Private validated final tree used for deterministic progressive reveal. */
    generationFinalData: jsonb("generation_final_data"),
  },
  (table) => [index("culture_tree_user_id_idx").on(table.userId)],
);
