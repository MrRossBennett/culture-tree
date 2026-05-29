import { CultureTreeSchema, type CultureTree, type TreeEnrichmentsMap } from "@repo/schemas";

import type { TreeSummaryCardData } from "~/components/tree-summary-card";

import { parseTreeEnrichments } from "./committed-branch-enrichment";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";

/** Columns from {@link cultureTree} needed to render a tree summary card. */
export type TreeSummaryRow = {
  id: string;
  seedQuery: string;
  data: unknown;
  enrichmentData: unknown;
  createdAt: Date;
  isPublic: boolean;
  generationStatus: string;
  generationRunId: string | null;
  generationStage: string | null;
  generationUpdatedAt: Date;
  generationError: string | null;
  generationFinalData: unknown;
};

function formatTreeListTitle(tree: CultureTree, seedQuery: string): string {
  const seed = tree.seed?.trim();
  if (seed) {
    return seed;
  }
  const q = seedQuery.trim();
  return q.length > 0 ? q : "Untitled tree";
}

function treeListPreviewItems(
  tree: CultureTree,
  enrichments: TreeEnrichmentsMap,
): TreeSummaryCardData["previewItems"] {
  return tree.items.slice(0, 6).map((item) => {
    const media = enrichments[item.id];
    return {
      type: item.type,
      imageUrl: media?.coverUrl ?? media?.thumbnailUrl ?? item.snapshot?.image ?? undefined,
    };
  });
}

/** Builds the summary-card view model shared by the index grid and branch modal. */
export function buildTreeSummaryCardData(row: TreeSummaryRow): TreeSummaryCardData {
  const generation = parseGenerationMetadata(row);
  const parsed = CultureTreeSchema.safeParse(row.data);
  if (!parsed.success) {
    return {
      id: row.id,
      listTitle: row.seedQuery.trim() || "Untitled tree",
      branchCount: 0,
      createdAt: row.createdAt.toISOString(),
      isPublic: row.isPublic,
      generationStatus: generation.status,
      previewItems: [],
    };
  }
  const tree = parsed.data;
  const enrichments = parseTreeEnrichments(row.enrichmentData);
  return {
    id: row.id,
    listTitle: formatTreeListTitle(tree, row.seedQuery),
    branchCount: tree.items.length,
    createdAt: row.createdAt.toISOString(),
    isPublic: row.isPublic,
    generationStatus: generation.status,
    previewItems: treeListPreviewItems(tree, enrichments),
  };
}
