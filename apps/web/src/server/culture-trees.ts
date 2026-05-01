import { $getUser } from "@repo/auth/tanstack/functions";
import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree, usageHistory, user as authUser } from "@repo/db/schema";
import { completeTreeItemConnection, enrichTree, searchExternalNodes } from "@repo/engine";
import { AI_GENERATION_USAGE_TYPES, ENTITLEMENTS, PLANS } from "@repo/entitlements";
import {
  countCultureTreeNodes,
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  type CultureTree,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { decideGrowBranchAllowance, type AllowanceLimitReached } from "./allowance-gates";
import { AddCultureTreeNodeDraftSchema, buildCultureTreeNode } from "./culture-tree-node-builder";
import {
  getResolvedEntitiesForTree,
  kickEntityResolutionRunner,
  resolveImmediateTreeItems,
} from "./entity-resolver.server";
import { withLimitReachedMessage } from "./limit-reached-messages";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";
import {
  type AllowancePeriod,
  buildAcceptedAiGenerationUsage,
  currentAllowancePeriod,
} from "./usage-history";

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

function appendItemToTree(tree: CultureTree, nextItem: TreeItem): CultureTree {
  return {
    ...tree,
    items: [...tree.items, nextItem],
  };
}

function removeItemFromTree(
  tree: CultureTree,
  itemId: string,
): { tree: CultureTree; removed: TreeItem } {
  const removed = tree.items.find((item) => item.id === itemId);
  if (!removed) {
    throw new Error("Item not found.");
  }

  return {
    tree: {
      ...tree,
      items: tree.items.filter((item) => item.id !== itemId),
    },
    removed,
  };
}

function removeEnrichmentForItem(
  enrichments: TreeEnrichmentsMap | null | undefined,
  itemId: string,
): TreeEnrichmentsMap | null {
  if (!enrichments) {
    return null;
  }

  return Object.fromEntries(Object.entries(enrichments).filter(([id]) => id !== itemId));
}

function parseTreeEnrichments(value: unknown): TreeEnrichmentsMap {
  if (value == null) {
    return {};
  }

  const parsed = TreeEnrichmentsMapSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

type AddCultureTreeNodeResult = { ok: true } | { ok: false; limitReached: AllowanceLimitReached };

async function countGrowBranchUsage(input: {
  personId: string;
  cultureTreeId: string;
}): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageHistory)
    .where(
      and(
        eq(usageHistory.personId, input.personId),
        eq(usageHistory.cultureTreeId, input.cultureTreeId),
        eq(usageHistory.usageType, ENTITLEMENTS.growBranch),
      ),
    )
    .limit(1);

  return row?.value ?? 0;
}

async function countPaidAiGenerationUsage(input: {
  personId: string;
  allowancePeriod: AllowancePeriod;
}): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageHistory)
    .where(
      and(
        eq(usageHistory.personId, input.personId),
        eq(usageHistory.effectivePlan, PLANS.pro),
        inArray(usageHistory.usageType, [...AI_GENERATION_USAGE_TYPES]),
        gte(usageHistory.createdAt, input.allowancePeriod.start),
        lt(usageHistory.createdAt, input.allowancePeriod.end),
      ),
    )
    .limit(1);

  return row?.value ?? 0;
}

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
    const allowancePeriod = currentAllowancePeriod();
    const allowance = decideGrowBranchAllowance({
      person: context.user,
      proAllowlist: process.env.PRO_ALLOWLIST,
      growBranchUsageCountForCultureTree: await countGrowBranchUsage({
        personId: context.user.id,
        cultureTreeId: data.treeId,
      }),
      paidAiGenerationUsageCountForAllowancePeriod: await countPaidAiGenerationUsage({
        personId: context.user.id,
        allowancePeriod,
      }),
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
    const nextTree = appendItemToTree(tree, nextNode);
    const currentEnrichments = parseTreeEnrichments(row.enrichmentData);
    let nextEnrichments = currentEnrichments;

    if (process.env.MOCK_ENGINE !== "true") {
      const map = await enrichTree({ ...tree, items: [nextNode] });
      const newEnrichments = Object.fromEntries(map);
      TreeEnrichmentsMapSchema.parse(newEnrichments);
      nextEnrichments = { ...currentEnrichments, ...newEnrichments };
    }

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

    await resolveImmediateTreeItems({
      treeId: data.treeId,
      items: [nextNode],
      enrichments: nextEnrichments,
    });
    kickEntityResolutionRunner();

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
    const { tree: nextTree, removed } = removeItemFromTree(tree, data.nodeId);
    const nextEnrichments = removeEnrichmentForItem(
      parseTreeEnrichments(row.enrichmentData),
      removed.id,
    );

    await db
      .update(cultureTree)
      .set({ data: nextTree, enrichmentData: nextEnrichments })
      .where(eq(cultureTree.id, data.treeId));

    return { ok: true as const };
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
