import type { CultureTree, TreeItem } from "@repo/schemas";

export function treeWithPendingItems(
  tree: CultureTree,
  pendingItems: readonly TreeItem[],
): CultureTree {
  if (pendingItems.length === 0) {
    return tree;
  }

  return {
    ...tree,
    items: [...tree.items, ...pendingItems],
  };
}

export function treeForVisiblePreview(input: {
  loaderTree: CultureTree;
  committedTree: CultureTree | null;
  pendingItems: readonly TreeItem[];
}): CultureTree {
  return treeWithPendingItems(input.committedTree ?? input.loaderTree, input.pendingItems);
}

export function loaderContainsCommittedTree(input: {
  loaderTree: CultureTree;
  committedTree: CultureTree;
}): boolean {
  if (input.committedTree.items.length === 0) {
    return false;
  }

  const loaderItemIds = new Set(input.loaderTree.items.map((item) => item.id));
  return input.committedTree.items.every((item) => loaderItemIds.has(item.id));
}
