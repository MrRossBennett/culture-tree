import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const usageHistory = pgTable(
  "usage_history",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usageType: text("usage_type").notNull(),
    effectivePlan: text("effective_plan").notNull(),
    cultureTreeId: text("culture_tree_id").notNull(),
    allowancePeriodStart: timestamp("allowance_period_start"),
    allowancePeriodEnd: timestamp("allowance_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("usage_history_person_id_idx").on(table.personId),
    index("usage_history_culture_tree_id_idx").on(table.cultureTreeId),
    index("usage_history_usage_type_idx").on(table.usageType),
  ],
);
