import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree, generateTree } from "@repo/engine";
import { CultureTreeSchema, TreeEnrichmentsMapSchema, TreeRequestSchema } from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

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
    });

    if (process.env.MOCK_ENGINE !== "true") {
      const map = await enrichTree(tree);
      const enrichments = Object.fromEntries(map);
      TreeEnrichmentsMapSchema.parse(enrichments);
      await db
        .update(cultureTree)
        .set({ enrichmentData: enrichments })
        .where(eq(cultureTree.id, id));
    }

    return { treeId: id, tree };
  });
