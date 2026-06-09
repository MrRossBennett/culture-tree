import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const curatorFollow = pgTable(
  "curator_follow",
  {
    id: text("id").primaryKey(),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followedUserId: text("followed_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("curator_follow_follower_followed_idx").on(
      table.followerUserId,
      table.followedUserId,
    ),
    index("curator_follow_follower_user_id_idx").on(table.followerUserId),
    index("curator_follow_followed_user_id_idx").on(table.followedUserId),
  ],
);
