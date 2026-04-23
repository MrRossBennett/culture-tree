import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree, generateTree } from "@repo/engine";
import {
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  TreeItemSchema,
  type TreeEnrichmentsMap,
  TreeRequestSchema,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

export const $generateCultureTree = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(TreeRequestSchema)
  .handler(async ({ data, context }) => {
    const tree = await generateTree(data);
    CultureTreeSchema.parse(tree);
    const id = nanoid();
    await db.insert(cultureTree).values({
      id,
      userId: context.user.id,
      data: tree,
      seedQuery: data.query,
      depth: data.depth,
      tone: data.tone,
      isPublic: false,
    });

    let enrichments: TreeEnrichmentsMap = {};
    if (process.env.MOCK_ENGINE !== "true") {
      const map = await enrichTree(tree);
      enrichments = Object.fromEntries(map);
      TreeEnrichmentsMapSchema.parse(enrichments);
      await db
        .update(cultureTree)
        .set({ enrichmentData: enrichments })
        .where(eq(cultureTree.id, id));
    }

    return { treeId: id, tree, enrichments };
  });

export const $seedTreeFromItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ item: TreeItemSchema }))
  .handler(async ({ data }) => {
    const query = data.item.year ? `${data.item.name} (${data.item.year})` : data.item.name;

    return $generateCultureTree({
      data: { query, depth: "standard", tone: "mixed" },
    });
  });
