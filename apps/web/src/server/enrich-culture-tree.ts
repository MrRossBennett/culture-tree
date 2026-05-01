import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { CultureTreeSchema } from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";

export const $enrichExistingCultureTree = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        data: cultureTree.data,
        enrichmentData: cultureTree.enrichmentData,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, data.treeId))
      .limit(1);

    if (!row || row.userId !== context.user.id) {
      throw new Error("Tree not found");
    }

    const tree = CultureTreeSchema.parse(row.data);
    const enrichments = await prepareEnrichmentsForCommittedBranches({
      tree,
      branches: tree.items,
      currentEnrichments: parseTreeEnrichments(row.enrichmentData),
      forceRefresh: true,
    });

    await db
      .update(cultureTree)
      .set({ enrichmentData: enrichments })
      .where(eq(cultureTree.id, data.treeId));

    await resolveCommittedBranches({ treeId: data.treeId, branches: tree.items, enrichments });

    return { enrichments };
  });
