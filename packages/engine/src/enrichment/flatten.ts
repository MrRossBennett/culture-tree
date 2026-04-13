import type { CultureTree, TreeNode } from "@repo/schemas";

export type BranchNodeWithId = { id: string; node: TreeNode };

function flattenChildNodes(nodes: readonly TreeNode[], parentId: string): BranchNodeWithId[] {
  const out: BranchNodeWithId[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i]!;
    const id = `${parentId}-${i}`;
    out.push({ id, node: child });
    if (child.children.length > 0) {
      out.push(...flattenChildNodes(child.children, id));
    }
  }
  return out;
}

/** Branch nodes only (excludes root). Ids match `TreePreview` path keys (`root-0-1`, …). */
export function flattenBranchNodes(tree: CultureTree): BranchNodeWithId[] {
  return flattenChildNodes(tree.children, "root");
}
