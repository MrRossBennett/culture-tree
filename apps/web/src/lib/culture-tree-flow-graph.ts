import type { CultureTree, TreeNode } from "@repo/schemas";

export const CULTURE_TREE_FLOW_SEED_ID = "seed";

export type TreeFlowRole = "seed" | "branch";

export type TreeFlowNode = {
  id: string;
  role: TreeFlowRole;
};

export type TreeFlowEdge = {
  id: string;
  source: string;
  target: string;
};

export type CultureTreeFlowGraph = {
  nodes: TreeFlowNode[];
  edges: TreeFlowEdge[];
  /** Same path ids as list view (`TreePreview`) for enrichment lookup */
  branchNodesById: Map<string, TreeNode>;
};

export function buildCultureTreeFlowGraph(tree: CultureTree): CultureTreeFlowGraph {
  const nodes: TreeFlowNode[] = [{ id: CULTURE_TREE_FLOW_SEED_ID, role: "seed" }];
  const edges: TreeFlowEdge[] = [];
  const branchNodesById = new Map<string, TreeNode>();

  function addBranch(node: TreeNode, parentId: string, index: number) {
    const id = parentId === CULTURE_TREE_FLOW_SEED_ID ? `root-${index}` : `${parentId}-${index}`;
    branchNodesById.set(id, node);
    nodes.push({ id, role: "branch" });
    edges.push({
      id: `${parentId}→${id}`,
      source: parentId,
      target: id,
    });
    for (let i = 0; i < node.children.length; i++) {
      addBranch(node.children[i]!, id, i);
    }
  }

  for (let i = 0; i < tree.children.length; i++) {
    addBranch(tree.children[i]!, CULTURE_TREE_FLOW_SEED_ID, i);
  }

  return { nodes, edges, branchNodesById };
}

/** Matches flow card `w-[min(22rem,…)]` (~352px) plus padding so edges don’t sit under neighbors */
const FLOW_NODE_WIDTH = 400;
/** Horizontal gap between sibling subtrees (leaf columns) */
const FLOW_SIBLING_GAP = 120;
/**
 * Vertical offset per tree depth. React Flow `position` is top-left; our cards are often
 * ~400–600px tall (cover + text). A step near card height keeps parent/child rows from
 * overlapping (unlike the small steps in the [overview demo](https://reactflow.dev/examples/overview), which uses short nodes).
 */
const FLOW_DEPTH_STEP = 420;
/** Matches flow seed card `w-[min(40rem,…)]` (~640px) for layout / edge clearance */
const FLOW_SEED_WIDTH = 640;

type XExtent = { minX: number; maxX: number };

function flowBranchId(parentId: string, index: number): string {
  return parentId === CULTURE_TREE_FLOW_SEED_ID ? `root-${index}` : `${parentId}-${index}`;
}

function shiftPositionsRight(
  positions: Map<string, { x: number; y: number }>,
  delta: number,
): Map<string, { x: number; y: number }> {
  if (delta === 0) return positions;
  const next = new Map<string, { x: number; y: number }>();
  for (const [id, p] of positions) {
    next.set(id, { x: p.x + delta, y: p.y });
  }
  return next;
}

/**
 * Recursive tree layout: leaves consume horizontal “columns”, parents center over their children’s span.
 * Avoids stacking every node at the same depth into one overcrowded row (old BFS layout used a fixed 280px step).
 */
export function layoutCultureTreeFlowPositions(
  tree: CultureTree,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  let leafCursor = 0;

  function layoutBranch(node: TreeNode, nodeId: string, depth: number): XExtent {
    const y = depth * FLOW_DEPTH_STEP;

    if (node.children.length === 0) {
      const x = leafCursor;
      leafCursor += FLOW_NODE_WIDTH + FLOW_SIBLING_GAP;
      positions.set(nodeId, { x, y });
      return { minX: x, maxX: x + FLOW_NODE_WIDTH };
    }

    const childExtents: XExtent[] = [];
    for (let i = 0; i < node.children.length; i++) {
      childExtents.push(layoutBranch(node.children[i]!, flowBranchId(nodeId, i), depth + 1));
    }

    const minX = childExtents[0]!.minX;
    const maxX = childExtents[childExtents.length - 1]!.maxX;
    const centerX = (minX + maxX) / 2;
    const x = centerX - FLOW_NODE_WIDTH / 2;
    positions.set(nodeId, { x, y });
    return {
      minX: Math.min(x, minX),
      maxX: Math.max(x + FLOW_NODE_WIDTH, maxX),
    };
  }

  if (tree.children.length === 0) {
    positions.set(CULTURE_TREE_FLOW_SEED_ID, { x: 0, y: 0 });
    return shiftPositionsRight(positions, 32);
  }

  leafCursor = 0;
  const topExtents: XExtent[] = [];
  for (let i = 0; i < tree.children.length; i++) {
    topExtents.push(layoutBranch(tree.children[i]!, flowBranchId(CULTURE_TREE_FLOW_SEED_ID, i), 1));
  }

  const minX = topExtents[0]!.minX;
  const maxX = topExtents[topExtents.length - 1]!.maxX;
  const centerX = (minX + maxX) / 2;
  positions.set(CULTURE_TREE_FLOW_SEED_ID, {
    x: centerX - FLOW_SEED_WIDTH / 2,
    y: 0,
  });

  let leftmost = Infinity;
  for (const [, p] of positions) {
    leftmost = Math.min(leftmost, p.x);
  }
  const padding = 32;
  return shiftPositionsRight(positions, leftmost < padding ? padding - leftmost : 0);
}
