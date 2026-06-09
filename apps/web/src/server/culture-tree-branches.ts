import {
  addBranchToGuideSection,
  removeBranchFromGuideSections,
  type CultureTree,
  type GuideSectionIdValue,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";

export type DeleteBranchResult = {
  tree: CultureTree;
  removedBranches: TreeItem[];
};

export function growBranchInCultureTree(input: {
  tree: CultureTree;
  guideSectionId: GuideSectionIdValue;
  branch: TreeItem;
}): CultureTree {
  return addBranchToGuideSection(input);
}

export function addManualBranchToCultureTree(input: {
  tree: CultureTree;
  branch: TreeItem;
}): CultureTree {
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
    tree: removeBranchFromGuideSections(tree, branchId),
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

export function countRemovedBranches(branches: readonly TreeItem[]): number {
  return branches.length;
}
