import {
  CultureTreeSchema,
  branchRoleForGuideSection,
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
  const targetSection = input.tree.guideSections.find(
    (section) => section.id === input.guideSectionId,
  );
  if (!targetSection) {
    throw new Error("Guide Section not found.");
  }

  const branch = {
    ...input.branch,
    branchRole: branchRoleForGuideSection(input.guideSectionId),
  };

  return CultureTreeSchema.parse({
    ...input.tree,
    guideSections: input.tree.guideSections.map((section) =>
      section.id === input.guideSectionId
        ? { ...section, items: [...section.items, branch] }
        : section,
    ),
    items: [...input.tree.items, branch],
  });
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
    tree: CultureTreeSchema.parse({
      ...tree,
      guideSections: tree.guideSections.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.id !== branchId),
      })),
      items: tree.items.filter((item) => item.id !== branchId),
    }),
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
