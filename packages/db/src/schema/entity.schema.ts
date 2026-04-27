import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";
import { cultureTree } from "./culture-tree.schema";

export const entity = pgTable(
  "entity",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    creatorName: text("creator_name"),
    creatorRole: text("creator_role"),
    disambiguation: text("disambiguation"),
    year: integer("year"),
    imageUrl: text("image_url"),
    description: text("description"),
    primaryExternalSource: text("primary_external_source").notNull(),
    primaryExternalType: text("primary_external_type").notNull(),
    primaryExternalId: text("primary_external_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("entity_primary_external_identity_idx").on(
      table.primaryExternalSource,
      table.primaryExternalType,
      table.primaryExternalId,
    ),
    index("entity_type_idx").on(table.type),
  ],
);

export const entityExternalIdentity = pgTable(
  "entity_external_identity",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entity.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("entity_external_identity_source_type_id_idx").on(
      table.source,
      table.externalType,
      table.externalId,
    ),
    index("entity_external_identity_entity_id_idx").on(table.entityId),
  ],
);

export const treeItemEntity = pgTable(
  "tree_item_entity",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => cultureTree.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entity.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tree_item_entity_tree_item_idx").on(table.treeId, table.itemId),
    index("tree_item_entity_entity_id_idx").on(table.entityId),
  ],
);

export const entityResolutionJob = pgTable(
  "entity_resolution_job",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => cultureTree.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    itemSnapshot: jsonb("item_snapshot").notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    lockedAt: timestamp("locked_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("entity_resolution_job_tree_item_idx").on(table.treeId, table.itemId),
    index("entity_resolution_job_status_scheduled_idx").on(table.status, table.scheduledAt),
  ],
);

export const entityLike = pgTable(
  "entity_like",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entity.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("entity_like_user_entity_idx").on(table.userId, table.entityId),
    index("entity_like_entity_id_idx").on(table.entityId),
    index("entity_like_user_id_idx").on(table.userId),
  ],
);
