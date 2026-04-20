import { $getUser } from "@repo/auth/tanstack/functions";
import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { searchExternalNodes } from "@repo/engine";
import {
  countCultureTreeNodes,
  CultureTreeSchema,
  TreeEnrichmentsMapSchema,
  type CultureTree,
  type TreeNode,
  type TreeEnrichmentsMap,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { AddCultureTreeNodeDraftSchema, buildCultureTreeNode } from "./culture-tree-node-builder";

function formatCuratorTreeListTitle(tree: CultureTree, seedQuery: string): string {
  const name = tree.name?.trim();
  const creator = tree.searchHint.creator?.trim();
  if (name && creator) return `${name} — ${creator}`;
  if (name) return name;
  const title = tree.searchHint.title?.trim();
  if (title && creator) return `${title} — ${creator}`;
  if (title) return title;
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

function parseTreeNodePath(nodeId: string): number[] {
  if (nodeId === "root") {
    return [];
  }
  if (!/^root(?:-\d+)+$/.test(nodeId)) {
    throw new Error("Invalid branch target.");
  }
  return nodeId
    .split("-")
    .slice(1)
    .map((segment) => {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) {
        throw new Error("Invalid branch target.");
      }
      return index;
    });
}

function appendChildAtPath(
  nodes: readonly TreeNode[],
  path: readonly number[],
  nextNode: TreeNode,
): TreeNode[] {
  const [index, ...rest] = path;
  if (index == null) {
    return [...nodes, nextNode];
  }

  const target = nodes[index];
  if (!target) {
    throw new Error("Branch not found.");
  }

  const updatedTarget: TreeNode =
    rest.length === 0
      ? { ...target, children: [...target.children, nextNode] }
      : { ...target, children: appendChildAtPath(target.children, rest, nextNode) };

  return nodes.map((node, currentIndex) => (currentIndex === index ? updatedTarget : node));
}

function appendNodeToTree(
  tree: CultureTree,
  parentNodeId: string,
  nextNode: TreeNode,
): CultureTree {
  const path = parseTreeNodePath(parentNodeId);
  return {
    ...tree,
    children: appendChildAtPath(tree.children, path, nextNode),
  };
}

function pathStartsWith(path: readonly number[], prefix: readonly number[]): boolean {
  return prefix.every((segment, index) => path[index] === segment);
}

function removeChildAtPath(
  nodes: readonly TreeNode[],
  path: readonly number[],
): { nodes: TreeNode[]; removed: TreeNode } {
  const [index, ...rest] = path;
  if (index == null) {
    throw new Error("Cannot delete root node.");
  }

  const target = nodes[index];
  if (!target) {
    throw new Error("Branch not found.");
  }

  if (rest.length === 0) {
    return {
      nodes: nodes.filter((_, currentIndex) => currentIndex !== index),
      removed: target,
    };
  }

  const next = removeChildAtPath(target.children, rest);
  return {
    nodes: nodes.map((node, currentIndex) =>
      currentIndex === index ? { ...target, children: next.nodes } : node,
    ),
    removed: next.removed,
  };
}

function removeNodeFromTree(
  tree: CultureTree,
  nodeId: string,
): { tree: CultureTree; removed: TreeNode; path: number[] } {
  const path = parseTreeNodePath(nodeId);
  if (path.length === 0) {
    throw new Error("Cannot delete root node.");
  }

  const next = removeChildAtPath(tree.children, path);
  return {
    tree: {
      ...tree,
      children: next.nodes,
    },
    removed: next.removed,
    path,
  };
}

function remapEnrichmentsAfterNodeDeletion(
  enrichments: TreeEnrichmentsMap | null | undefined,
  deletedPath: readonly number[],
): TreeEnrichmentsMap | null {
  if (!enrichments) {
    return null;
  }

  const deletedIndex = deletedPath.at(-1);
  if (deletedIndex == null) {
    return enrichments;
  }

  const parentPath = deletedPath.slice(0, -1);
  const nextEntries = Object.entries(enrichments).flatMap(([nodeId, media]) => {
    let path: number[];
    try {
      path = parseTreeNodePath(nodeId);
    } catch {
      return [[nodeId, media] as const];
    }

    if (pathStartsWith(path, deletedPath)) {
      return [];
    }

    if (
      path.length > parentPath.length &&
      pathStartsWith(path, parentPath) &&
      path[parentPath.length]! > deletedIndex
    ) {
      const shiftedPath = [...path];
      shiftedPath[parentPath.length] = shiftedPath[parentPath.length]! - 1;
      const shiftedId = `root-${shiftedPath.join("-")}`;
      return [[shiftedId, media] as const];
    }

    return [[nodeId, media] as const];
  });

  return Object.fromEntries(nextEntries);
}

export const $getCultureTreeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data: { treeId } }) => {
    const user = await $getUser();
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        data: cultureTree.data,
        enrichmentData: cultureTree.enrichmentData,
        createdAt: cultureTree.createdAt,
        isPublic: cultureTree.isPublic,
      })
      .from(cultureTree)
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
    const nextTree = appendNodeToTree(tree, data.parentNodeId, nextNode);

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
    const { tree: nextTree, path } = removeNodeFromTree(tree, data.nodeId);
    const parsedEnrichments = TreeEnrichmentsMapSchema.safeParse(row.enrichmentData);
    const nextEnrichments = remapEnrichmentsAfterNodeDeletion(
      parsedEnrichments.success ? parsedEnrichments.data : null,
      path,
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
