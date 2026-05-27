import {
  CORE_RECOMMENDATION_GUIDE_SECTION_IDS,
  CultureTreeSchema,
  branchRoleForGuideSection,
  type CultureTree,
  type GuideSection,
  type GuideSectionIdValue,
  type NodeTypeValue,
  type TreeItem,
} from "./tree";

export function guideSectionsIncludeCore(sections: readonly GuideSection[]): boolean {
  return CORE_RECOMMENDATION_GUIDE_SECTION_IDS.every((sectionId) =>
    sections.some((section) => section.id === sectionId),
  );
}

export function branchForGuideSection(input: {
  guideSectionId: GuideSectionIdValue;
  branch: TreeItem;
}): TreeItem {
  return {
    ...input.branch,
    branchRole: branchRoleForGuideSection(input.guideSectionId),
  };
}

export function addBranchToGuideSection(input: {
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

  const branch = branchForGuideSection({
    guideSectionId: input.guideSectionId,
    branch: input.branch,
  });

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

export function removeBranchFromGuideSections(tree: CultureTree, branchId: string): CultureTree {
  return CultureTreeSchema.parse({
    ...tree,
    guideSections: tree.guideSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.id !== branchId),
    })),
    items: tree.items.filter((item) => item.id !== branchId),
  });
}

export function cultureTreeWithGuideSectionItems(
  tree: CultureTree,
  items: readonly TreeItem[],
): CultureTree {
  const itemIds = new Set(items.map((item) => item.id));

  return CultureTreeSchema.parse({
    ...tree,
    guideSections: tree.guideSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => itemIds.has(item.id)),
    })),
    items: [...items],
  });
}

export function cultureTreeWithRevealedBranches(
  finalTree: CultureTree,
  revealedBranchCount: number,
): CultureTree {
  if (revealedBranchCount >= finalTree.items.length) {
    return CultureTreeSchema.parse(finalTree);
  }

  return cultureTreeWithGuideSectionItems(finalTree, finalTree.items.slice(0, revealedBranchCount));
}

export function filterCultureTreeToNodeTypes(
  tree: CultureTree,
  nodeTypes: readonly NodeTypeValue[],
): CultureTree {
  if (nodeTypes.length === 0) {
    return tree;
  }

  const allowedTypes = new Set<NodeTypeValue>(nodeTypes);
  const guideSections = tree.guideSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => allowedTypes.has(item.type)),
  }));

  return CultureTreeSchema.parse({
    ...tree,
    guideSections: guideSectionsIncludeCore(guideSections) ? guideSections : [],
    items: tree.items.filter((item) => allowedTypes.has(item.type)),
  });
}
