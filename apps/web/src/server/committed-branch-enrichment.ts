import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree } from "@repo/engine";
import {
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  type CultureTree,
  type EnrichedMedia,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";

import {
  enqueueTreeForResolution,
  kickEntityResolutionRunner,
  resolveImmediateTreeItems,
} from "./entity-resolver.server";

export function parseTreeEnrichments(value: unknown): TreeEnrichmentsMap {
  const parsed = TreeEnrichmentsMapSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function hasUsefulEnrichment(value: unknown): boolean {
  return value != null && typeof value === "object" && Object.keys(value).length > 0;
}

function compactMedia(media: EnrichedMedia): EnrichedMedia {
  return Object.fromEntries(
    Object.entries(media).filter(([, value]) => value !== undefined),
  ) as EnrichedMedia;
}

function hasMediaData(media: EnrichedMedia | undefined): media is EnrichedMedia {
  return media != null && Object.keys(compactMedia(media)).length > 0;
}

export async function prepareEnrichmentsForCommittedBranches(input: {
  tree: CultureTree;
  branches: readonly TreeItem[];
  currentEnrichments: TreeEnrichmentsMap;
  forceRefresh?: boolean;
}): Promise<TreeEnrichmentsMap> {
  if (input.branches.length === 0 || process.env.MOCK_ENGINE === "true") {
    return input.currentEnrichments;
  }

  const partialTree = CultureTreeSchema.parse({ ...input.tree, items: [...input.branches] });
  const map = await enrichTree(partialTree, { forceRefresh: input.forceRefresh });
  const newEnrichments = Object.fromEntries(map);
  TreeEnrichmentsMapSchema.parse(newEnrichments);

  if (!input.forceRefresh) {
    const nextEnrichments = { ...input.currentEnrichments, ...newEnrichments };
    TreeEnrichmentsMapSchema.parse(nextEnrichments);
    return nextEnrichments;
  }

  const nextEnrichments = Object.fromEntries(
    input.tree.items.map((item) => {
      const current = input.currentEnrichments[item.id];
      const refreshed = compactMedia(newEnrichments[item.id] ?? {});
      const merged = hasMediaData(refreshed) ? { ...current, ...refreshed } : (current ?? {});
      return [item.id, merged];
    }),
  );
  TreeEnrichmentsMapSchema.parse(nextEnrichments);
  return nextEnrichments;
}

export async function resolveCommittedBranches(input: {
  treeId: string;
  branches: readonly TreeItem[];
  enrichments: TreeEnrichmentsMap;
}): Promise<void> {
  await resolveImmediateTreeItems({
    treeId: input.treeId,
    items: [...input.branches],
    enrichments: input.enrichments,
  });
  await enqueueTreeForResolution({ treeId: input.treeId, items: [...input.branches] });
  kickEntityResolutionRunner();
}

export async function enrichCommittedBranchesOnCultureTree(input: {
  treeId: string;
  tree: CultureTree;
  branches: readonly TreeItem[];
}): Promise<void> {
  const [row] = await db
    .select({ enrichmentData: cultureTree.enrichmentData })
    .from(cultureTree)
    .where(eq(cultureTree.id, input.treeId))
    .limit(1);

  const enrichments = await prepareEnrichmentsForCommittedBranches({
    tree: input.tree,
    branches: input.branches,
    currentEnrichments: parseTreeEnrichments(row?.enrichmentData),
  });

  await db
    .update(cultureTree)
    .set({ enrichmentData: enrichments })
    .where(eq(cultureTree.id, input.treeId));

  await resolveCommittedBranches({
    treeId: input.treeId,
    branches: input.branches,
    enrichments,
  });
}
