import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree } from "@repo/engine";
import { CultureTreeSchema, TreeEnrichmentsMapSchema } from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const $enrichExistingCultureTree = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        data: cultureTree.data,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, data.treeId))
      .limit(1);

    if (!row || row.userId !== context.user.id) {
      throw new Error("Tree not found");
    }

    const tree = CultureTreeSchema.parse(row.data);
    const map = await enrichTree(tree);
    const enrichments = Object.fromEntries(map);
    TreeEnrichmentsMapSchema.parse(enrichments);

    await db
      .update(cultureTree)
      .set({ enrichmentData: enrichments })
      .where(eq(cultureTree.id, data.treeId));

    return { enrichments };
  });
