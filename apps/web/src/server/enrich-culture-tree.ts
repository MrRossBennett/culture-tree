import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree } from "@repo/engine";
import { CultureTreeSchema, TreeEnrichmentsMapSchema, type EnrichedMedia } from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { kickEntityResolutionRunner, resolveImmediateTreeItems } from "./entity-resolver.server";

function compactMedia(media: EnrichedMedia): EnrichedMedia {
  return Object.fromEntries(
    Object.entries(media).filter(([, value]) => value !== undefined),
  ) as EnrichedMedia;
}

function hasMediaData(media: EnrichedMedia | undefined): media is EnrichedMedia {
  return media != null && Object.keys(compactMedia(media)).length > 0;
}

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
    const currentEnrichmentsResult = TreeEnrichmentsMapSchema.safeParse(row.enrichmentData ?? {});
    const currentEnrichments = currentEnrichmentsResult.success
      ? currentEnrichmentsResult.data
      : {};
    const map = await enrichTree(tree, { forceRefresh: true });
    const refreshedEnrichments = Object.fromEntries(map);
    TreeEnrichmentsMapSchema.parse(refreshedEnrichments);
    const enrichments = Object.fromEntries(
      tree.items.map((item) => {
        const current = currentEnrichments[item.id];
        const refreshed = compactMedia(refreshedEnrichments[item.id] ?? {});
        const merged = hasMediaData(refreshed) ? { ...current, ...refreshed } : (current ?? {});
        return [item.id, merged];
      }),
    );
    TreeEnrichmentsMapSchema.parse(enrichments);

    await db
      .update(cultureTree)
      .set({ enrichmentData: enrichments })
      .where(eq(cultureTree.id, data.treeId));

    await resolveImmediateTreeItems({ treeId: data.treeId, items: tree.items, enrichments });
    kickEntityResolutionRunner();

    return { enrichments };
  });
