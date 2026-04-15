import type { CultureTree } from "@repo/schemas";
import { describe, expect, it } from "vitest";

import {
  buildCultureTreeFlowGraph,
  CULTURE_TREE_FLOW_SEED_ID,
  layoutCultureTreeFlowPositions,
} from "./culture-tree-flow-graph";

const minimalTree = {
  name: "Seed work",
  type: "root" as const,
  reason: "",
  searchHint: { title: "Seed work" },
  source: "ai" as const,
  children: [
    {
      name: "Branch A",
      type: "album" as const,
      reason: "r",
      connectionType: "thematic" as const,
      searchHint: { title: "Branch A" },
      source: "ai" as const,
      children: [
        {
          name: "Leaf A1",
          type: "film" as const,
          reason: "r",
          connectionType: "thematic" as const,
          searchHint: { title: "Leaf A1" },
          source: "ai" as const,
          children: [],
        },
      ],
    },
    {
      name: "Branch B",
      type: "book" as const,
      reason: "r",
      connectionType: "influence" as const,
      searchHint: { title: "Branch B" },
      source: "ai" as const,
      children: [],
    },
  ],
} satisfies CultureTree;

describe("buildCultureTreeFlowGraph", () => {
  it("uses seed id and root-* paths matching list view", () => {
    const { nodes, edges, branchNodesById } = buildCultureTreeFlowGraph(minimalTree);

    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(CULTURE_TREE_FLOW_SEED_ID);
    expect(ids).toContain("root-0");
    expect(ids).toContain("root-1");
    expect(ids).toContain("root-0-0");

    expect(branchNodesById.get("root-0")?.name).toBe("Branch A");
    expect(branchNodesById.get("root-0-0")?.name).toBe("Leaf A1");
    expect(branchNodesById.get("root-1")?.name).toBe("Branch B");

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: CULTURE_TREE_FLOW_SEED_ID, target: "root-0" }),
        expect.objectContaining({ source: CULTURE_TREE_FLOW_SEED_ID, target: "root-1" }),
        expect.objectContaining({ source: "root-0", target: "root-0-0" }),
      ]),
    );
    expect(edges).toHaveLength(nodes.length - 1);
  });

  it("returns only seed when tree has no branches", () => {
    const empty: CultureTree = {
      ...minimalTree,
      children: [],
    };
    const { nodes, edges } = buildCultureTreeFlowGraph(empty);
    expect(nodes).toEqual([{ id: CULTURE_TREE_FLOW_SEED_ID, role: "seed" }]);
    expect(edges).toEqual([]);
  });
});

describe("layoutCultureTreeFlowPositions", () => {
  it("assigns y by depth and includes every graph node", () => {
    const graph = buildCultureTreeFlowGraph(minimalTree);
    const pos = layoutCultureTreeFlowPositions(minimalTree);

    for (const n of graph.nodes) {
      expect(pos.has(n.id)).toBe(true);
    }
    expect(pos.get(CULTURE_TREE_FLOW_SEED_ID)?.y).toBe(0);
    expect(pos.get("root-0")?.y).toBe(pos.get("root-1")?.y);
    expect(pos.get("root-0-0")?.y).toBeGreaterThan(pos.get("root-0")!.y);
  });

  it("spaces sibling leaf columns at least node width + gap apart", () => {
    const pos = layoutCultureTreeFlowPositions(minimalTree);
    const a = pos.get("root-0-0")!;
    const b = pos.get("root-1")!;
    expect(b.x - a.x).toBeGreaterThanOrEqual(400);
  });

  it("spaces each depth by FLOW_DEPTH_STEP so tall cards can stack", () => {
    const pos = layoutCultureTreeFlowPositions(minimalTree);
    expect(pos.get("root-0-0")!.y - pos.get("root-0")!.y).toBe(420);
    expect(pos.get("root-0")!.y - pos.get(CULTURE_TREE_FLOW_SEED_ID)!.y).toBe(420);
  });
});
