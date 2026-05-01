import { $getUser } from "@repo/auth/tanstack/functions";
import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree, usageHistory, user as authUser } from "@repo/db/schema";
import { completeTreeItemConnection, searchExternalNodes } from "@repo/engine";
import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import {
  countCultureTreeNodes,
  CultureTreeSchema,
  type CultureTree,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { prepareGrowBranchAllowanceDecision } from "./ai-generation-usage";
import type { AllowanceLimitReached } from "./allowance-gates";
import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";
import {
  countBranchesInSubtree,
  deleteBranchFromCultureTree,
  growBranchInCultureTree,
  removeEnrichmentsForBranches,
} from "./culture-tree-branches";
import { AddCultureTreeNodeDraftSchema, buildCultureTreeNode } from "./culture-tree-node-builder";
import { getResolvedEntitiesForTree } from "./entity-resolver.server";
import { withLimitReachedMessage } from "./limit-reached-messages";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";
import { buildAcceptedAiGenerationUsage } from "./usage-history";

function formatCuratorTreeListTitle(tree: CultureTree, seedQuery: string): string {
  const seed = tree.seed?.trim();
  if (seed) {
    return seed;
  }
  const q = seedQuery.trim();
  return q.length > 0 ? q : "Untitled tree";
}

type TreeListPreviewItem = {
  type: NodeTypeValue;
  imageUrl?: string;
};

function treeListPreviewItems(
  tree: CultureTree,
  enrichments: TreeEnrichmentsMap,
): TreeListPreviewItem[] {
  return tree.items.slice(0, 6).map((item) => {
    const media = enrichments[item.id];
    return {
      type: item.type,
      imageUrl: media?.coverUrl ?? media?.thumbnailUrl ?? item.snapshot?.image ?? undefined,
    };
  });
}

const AddCultureTreeNodeInputSchema = z.object({
  treeId: z.string().min(1),
  parentNodeId: z.string().min(1),
  node: AddCultureTreeNodeDraftSchema,
});

const DeleteCultureTreeNodeInputSchema = z.object({
  treeId: z.string().min(1),
  nodeId: z.string().min(1),
});

const SearchCultureTreeNodesInputSchema = z.object({
  query: z.string().trim().min(1),
});

type AddCultureTreeNodeResult = { ok: true } | { ok: false; limitReached: AllowanceLimitReached };

export const $getCultureTreeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data: { treeId } }) => {
    const user = await $getUser();
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        username: authUser.username,
        data: cultureTree.data,
        enrichmentData: cultureTree.enrichmentData,
        createdAt: cultureTree.createdAt,
        isPublic: cultureTree.isPublic,
        generationStatus: cultureTree.generationStatus,
        generationRunId: cultureTree.generationRunId,
        generationStage: cultureTree.generationStage,
        generationUpdatedAt: cultureTree.generationUpdatedAt,
        generationError: cultureTree.generationError,
        generationFinalData: cultureTree.generationFinalData,
      })
      .from(cultureTree)
      .leftJoin(authUser, eq(authUser.id, cultureTree.userId))
      .where(eq(cultureTree.id, treeId))
      .limit(1);
    if (!row) {
      return null;
    }
    const generation = parseGenerationMetadata(row);
    const allowed = (row.isPublic && generation.status === "ready") || user?.id === row.userId;
    if (!allowed) {
      return null;
    }
    const tree = CultureTreeSchema.parse(row.data);
    const enrichments = parseTreeEnrichments(row.enrichmentData);
    const resolvedEntities = await getResolvedEntitiesForTree({
      treeId: row.id,
      currentUserId: user?.id,
    });
    return {
      treeId: row.id,
      userId: row.userId,
      username: row.username,
      tree,
      enrichments,
      resolvedEntities,
      createdAt: row.createdAt,
      isPublic: row.isPublic,
      generation,
    };
  });

export const $setCultureTreePublic = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      treeId: z.string().min(1),
      isPublic: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const [row] = await db
      .select({ id: cultureTree.id, userId: cultureTree.userId })
      .from(cultureTree)
      .where(eq(cultureTree.id, data.treeId))
      .limit(1);
    if (!row || row.userId !== context.user.id) {
      throw new Error("Tree not found");
    }
    await db
      .update(cultureTree)
      .set({ isPublic: data.isPublic })
      .where(eq(cultureTree.id, data.treeId));
    return { ok: true as const, isPublic: data.isPublic };
  });

export const $searchCultureTreeNodes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(SearchCultureTreeNodesInputSchema)
  .handler(async ({ data }) => {
    const results = await searchExternalNodes(data.query);
    return { results };
  });

export const $addCultureTreeNode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(AddCultureTreeNodeInputSchema)
  .handler(async ({ data, context }): Promise<AddCultureTreeNodeResult> => {
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
    const { allowance, allowancePeriod } = await prepareGrowBranchAllowanceDecision({
      person: context.user,
      cultureTreeId: data.treeId,
      proAllowlist: process.env.PRO_ALLOWLIST,
    });
    if (!allowance.allowed) {
      return {
        ok: false,
        limitReached: withLimitReachedMessage({
          action: "grow_branch",
          limitReached: allowance.limitReached,
        }),
      };
    }

    const draftNode = buildCultureTreeNode(data.node);
    const nextNode = await completeTreeItemConnection(tree, draftNode);
    const nextTree = growBranchInCultureTree({
      tree,
      parentBranchId: data.parentNodeId,
      branch: nextNode,
    });
    const currentEnrichments = parseTreeEnrichments(row.enrichmentData);
    const nextEnrichments = await prepareEnrichmentsForCommittedBranches({
      tree,
      branches: [nextNode],
      currentEnrichments,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(cultureTree)
        .set({ data: nextTree, enrichmentData: nextEnrichments })
        .where(eq(cultureTree.id, data.treeId));

      await tx.insert(usageHistory).values(
        buildAcceptedAiGenerationUsage({
          id: nanoid(),
          person: context.user,
          cultureTreeId: data.treeId,
          usageType: ENTITLEMENTS.growBranch,
          proAllowlist: process.env.PRO_ALLOWLIST,
          allowancePeriod: allowance.effectivePlan === PLANS.pro ? allowancePeriod : null,
        }),
      );
    });

    await resolveCommittedBranches({
      treeId: data.treeId,
      branches: [nextNode],
      enrichments: nextEnrichments,
    });

    return { ok: true };
  });

export const $deleteCultureTreeNode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(DeleteCultureTreeNodeInputSchema)
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
    const { tree: nextTree, removedBranches } = deleteBranchFromCultureTree(tree, data.nodeId);
    const nextEnrichments = removeEnrichmentsForBranches(
      parseTreeEnrichments(row.enrichmentData),
      removedBranches,
    );

    await db
      .update(cultureTree)
      .set({ data: nextTree, enrichmentData: nextEnrichments })
      .where(eq(cultureTree.id, data.treeId));

    return { ok: true as const, removedBranchCount: countBranchesInSubtree(removedBranches) };
  });

export const $listMyCultureTrees = createServerFn({ method: "GET" }).handler(async () => {
  const user = await $getUser();
  if (!user) {
    return {
      count: 0,
      trees: [] as {
        id: string;
        seedQuery: string;
        createdAt: string;
        nodeCount: number;
        listTitle: string;
        isPublic: boolean;
        generationStatus: string;
        previewItems: TreeListPreviewItem[];
      }[],
    };
  }
  const [countRow] = await db
    .select({ value: count() })
    .from(cultureTree)
    .where(eq(cultureTree.userId, user.id));
  const rows = await db
    .select({
      id: cultureTree.id,
      seedQuery: cultureTree.seedQuery,
      data: cultureTree.data,
      enrichmentData: cultureTree.enrichmentData,
      createdAt: cultureTree.createdAt,
      isPublic: cultureTree.isPublic,
      generationStatus: cultureTree.generationStatus,
      generationRunId: cultureTree.generationRunId,
      generationStage: cultureTree.generationStage,
      generationUpdatedAt: cultureTree.generationUpdatedAt,
      generationError: cultureTree.generationError,
      generationFinalData: cultureTree.generationFinalData,
    })
    .from(cultureTree)
    .where(eq(cultureTree.userId, user.id))
    .orderBy(desc(cultureTree.createdAt));
  const trees = rows.map((r) => {
    const parsed = CultureTreeSchema.safeParse(r.data);
    if (!parsed.success) {
      const generation = parseGenerationMetadata(r);
      return {
        id: r.id,
        seedQuery: r.seedQuery,
        createdAt: r.createdAt.toISOString(),
        nodeCount: 0,
        listTitle: r.seedQuery.trim() || "Untitled tree",
        isPublic: r.isPublic,
        generationStatus: generation.status,
        previewItems: [],
      };
    }
    const t = parsed.data;
    const generation = parseGenerationMetadata(r);
    const enrichments = parseTreeEnrichments(r.enrichmentData);
    return {
      id: r.id,
      seedQuery: r.seedQuery,
      createdAt: r.createdAt.toISOString(),
      nodeCount: countCultureTreeNodes(t),
      listTitle: formatCuratorTreeListTitle(t, r.seedQuery),
      isPublic: r.isPublic,
      generationStatus: generation.status,
      previewItems: treeListPreviewItems(t, enrichments),
    };
  });
  return { count: countRow?.value ?? 0, trees };
});
