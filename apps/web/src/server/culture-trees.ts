import { $getUser } from "@repo/auth/tanstack/functions";
import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree, user as authUser } from "@repo/db/schema";
import { searchExternalNodes } from "@repo/engine";
import {
  countCultureTreeNodes,
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { AddCultureTreeNodeDraftSchema, buildCultureTreeNode } from "./culture-tree-node-builder";

function formatCuratorTreeListTitle(tree: CultureTree, seedQuery: string): string {
  const seed = tree.seed?.trim();
  if (seed) {
    return seed;
  }
  const q = seedQuery.trim();
  return q.length > 0 ? q : "Untitled tree";
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
      })
      .from(cultureTree)
      .leftJoin(authUser, eq(authUser.id, cultureTree.userId))
      .where(eq(cultureTree.id, treeId))
      .limit(1);
    if (!row) {
      return null;
    }
    const allowed = row.isPublic || user?.id === row.userId;
    if (!allowed) {
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
      username: row.username,
      tree,
      enrichments,
      createdAt: row.createdAt,
      isPublic: row.isPublic,
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
    const nextNode = buildCultureTreeNode(data.node);
    const nextTree = appendItemToTree(tree, nextNode);

    await db.update(cultureTree).set({ data: nextTree }).where(eq(cultureTree.id, data.treeId));

    return { ok: true as const };
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
    const parsedEnrichments = TreeEnrichmentsMapSchema.safeParse(row.enrichmentData);
    const nextEnrichments = removeEnrichmentForItem(
      parsedEnrichments.success ? parsedEnrichments.data : null,
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
      createdAt: cultureTree.createdAt,
      isPublic: cultureTree.isPublic,
    })
    .from(cultureTree)
    .where(eq(cultureTree.userId, user.id))
    .orderBy(desc(cultureTree.createdAt));
  const trees = rows.map((r) => {
    const parsed = CultureTreeSchema.safeParse(r.data);
    if (!parsed.success) {
      return {
        id: r.id,
        seedQuery: r.seedQuery,
        createdAt: r.createdAt.toISOString(),
        nodeCount: 0,
        listTitle: r.seedQuery.trim() || "Untitled tree",
        isPublic: r.isPublic,
      };
    }
    const t = parsed.data;
    return {
      id: r.id,
      seedQuery: r.seedQuery,
      createdAt: r.createdAt.toISOString(),
      nodeCount: countCultureTreeNodes(t),
      listTitle: formatCuratorTreeListTitle(t, r.seedQuery),
      isPublic: r.isPublic,
    };
  });
  return { count: countRow?.value ?? 0, trees };
});
