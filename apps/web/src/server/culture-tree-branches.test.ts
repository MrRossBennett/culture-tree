import type { CultureTree, TreeItem } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  CULTURE_TREE_SEED_BRANCH_ID,
  countBranchesInSubtree,
  deleteBranchFromCultureTree,
  growBranchInCultureTree,
  removeEnrichmentsForBranches,
} from "./culture-tree-branches";

const branch: TreeItem = {
  id: "branch_1",
  name: "Liquid Swords",
  type: "album",
  reason: "Turns noir dread into cold-blooded mythology.",
  connectionType: "spiritual-kin",
  searchHint: { title: "Liquid Swords", creator: "GZA" },
  source: "user",
};

const tree: CultureTree = {
  seed: "Ghost Dog",
  seedType: "root",
  items: [branch],
};

describe("Culture Tree Branch mutations", () => {
  it("grows a top-level Branch from the Seed", () => {
    const nextBranch = { ...branch, id: "branch_2", name: "Le Samourai" };

    const nextTree = growBranchInCultureTree({
      tree,
      parentBranchId: CULTURE_TREE_SEED_BRANCH_ID,
      branch: nextBranch,
    });

    expect(nextTree.items.map((item) => item.id)).toEqual(["branch_1", "branch_2"]);
  });

  it("keeps Child Branch growth behind the Branch mutation interface", () => {
    expect(() =>
      growBranchInCultureTree({
        tree,
        parentBranchId: "branch_1",
        branch: { ...branch, id: "branch_2" },
      }),
    ).toThrow("Child Branch growth is not available yet.");
  });

  it("deletes a Branch and reports the removed Subtree", () => {
    const result = deleteBranchFromCultureTree(tree, "branch_1");

    expect(result.tree.items).toEqual([]);
    expect(result.removedBranches).toEqual([branch]);
    expect(countBranchesInSubtree(result.removedBranches)).toBe(1);
  });

  it("removes enrichment data for every Branch in the deleted Subtree", () => {
    expect(
      removeEnrichmentsForBranches(
        {
          branch_1: { coverUrl: "https://example.com/liquid-swords.jpg" },
          branch_2: { coverUrl: "https://example.com/le-samourai.jpg" },
        },
        [branch],
      ),
    ).toEqual({
      branch_2: { coverUrl: "https://example.com/le-samourai.jpg" },
    });
  });
});
