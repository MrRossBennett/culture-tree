import type { CultureTree, TreeEnrichmentsMap, TreeItem } from "@repo/schemas";

export const CULTURE_TREE_SEED_BRANCH_ID = "root";

export type DeleteBranchResult = {
  tree: CultureTree;
  removedBranches: TreeItem[];
};

export function growBranchInCultureTree(input: {
  tree: CultureTree;
  parentBranchId: string;
  branch: TreeItem;
}): CultureTree {
  if (input.parentBranchId !== CULTURE_TREE_SEED_BRANCH_ID) {
    throw new Error("Child Branch growth is not available yet.");
  }

  return {
    ...input.tree,
    items: [...input.tree.items, input.branch],
  };
}

export function deleteBranchFromCultureTree(
  tree: CultureTree,
  branchId: string,
): DeleteBranchResult {
  const removed = tree.items.find((item) => item.id === branchId);
  if (!removed) {
    throw new Error("Branch not found.");
  }

  return {
    tree: {
      ...tree,
      items: tree.items.filter((item) => item.id !== branchId),
    },
    removedBranches: [removed],
  };
}

export function removeEnrichmentsForBranches(
  enrichments: TreeEnrichmentsMap,
  branches: readonly TreeItem[],
): TreeEnrichmentsMap {
  const removedIds = new Set(branches.map((branch) => branch.id));
  return Object.fromEntries(Object.entries(enrichments).filter(([id]) => !removedIds.has(id)));
}

export function countBranchesInSubtree(branches: readonly TreeItem[]): number {
  return branches.length;
}
