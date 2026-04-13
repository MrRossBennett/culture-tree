import { $getUser } from "@repo/auth/tanstack/functions";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import {
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  type TreeEnrichmentsMap,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";

export const $getCultureTreeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data: { treeId } }) => {
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        data: cultureTree.data,
        enrichmentData: cultureTree.enrichmentData,
        createdAt: cultureTree.createdAt,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, treeId))
      .limit(1);
    if (!row) {
      return null;
    }
    const tree = CultureTreeSchema.parse(row.data);
    let enrichments: TreeEnrichmentsMap = {};
    if (row.enrichmentData != null) {
      const parsed = TreeEnrichmentsMapSchema.safeParse(row.enrichmentData);
      if (parsed.success) {
        enrichments = parsed.data;
      }
    }
    return {
      treeId: row.id,
      userId: row.userId,
      tree,
      enrichments,
      createdAt: row.createdAt,
    };
  });

export const $listMyCultureTrees = createServerFn({ method: "GET" }).handler(async () => {
  const user = await $getUser();
  if (!user) {
    return {
      count: 0,
      recent: [] as { id: string; seedQuery: string; createdAt: string }[],
    };
  }
  const [countRow] = await db
    .select({ value: count() })
    .from(cultureTree)
    .where(eq(cultureTree.userId, user.id));
  const recentRows = await db
    .select({
      id: cultureTree.id,
      seedQuery: cultureTree.seedQuery,
      createdAt: cultureTree.createdAt,
    })
    .from(cultureTree)
    .where(eq(cultureTree.userId, user.id))
    .orderBy(desc(cultureTree.createdAt))
    .limit(10);
  const recent = recentRows.map((r) => ({
    id: r.id,
    seedQuery: r.seedQuery,
    createdAt: r.createdAt.toISOString(),
  }));
  return { count: countRow?.value ?? 0, recent };
});
