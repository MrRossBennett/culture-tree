import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  countRemovedBranches,
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
  guideSections: [],
  items: [branch],
};

const guideTree = CultureTreeSchema.parse({
  seed: "Ghost Dog",
  seedType: "root",
  guideSections: [
    {
      id: "start-here",
      title: "Start Here",
      items: [{ ...branch, id: "start_1", branchRole: "essential-next" }],
    },
    {
      id: "more-like-this",
      title: "More Like This",
      items: [{ ...branch, id: "similar_1", branchRole: "similar-appetite" }],
    },
    {
      id: "go-sideways",
      title: "Go Sideways",
      items: [{ ...branch, id: "sideways_1", branchRole: "sideways-path" }],
    },
    {
      id: "go-deeper",
      title: "Go Deeper",
      items: [{ ...branch, id: "deep_1", branchRole: "deep-cut" }],
    },
  ],
  items: [
    { ...branch, id: "start_1", branchRole: "essential-next" },
    { ...branch, id: "similar_1", branchRole: "similar-appetite" },
    { ...branch, id: "sideways_1", branchRole: "sideways-path" },
    { ...branch, id: "deep_1", branchRole: "deep-cut" },
  ],
});

describe("Culture Tree Branch mutations", () => {
  it("grows a Branch into a Guide Section with the section Branch Role", () => {
    const nextBranch = { ...branch, id: "branch_2", name: "Le Samourai", branchRole: undefined };

    const nextTree = growBranchInCultureTree({
      tree: guideTree,
      guideSectionId: "more-like-this",
      branch: nextBranch,
    });

    expect(
      nextTree.guideSections.find((section) => section.id === "more-like-this")?.items,
    ).toEqual([
      { ...branch, id: "similar_1", branchRole: "similar-appetite" },
      { ...nextBranch, branchRole: "similar-appetite" },
    ]);
    expect(nextTree.items.at(-1)).toMatchObject({
      id: "branch_2",
      branchRole: "similar-appetite",
    });
  });

  it("rejects growth into an unavailable Guide Section", () => {
    expect(() =>
      growBranchInCultureTree({
        tree: guideTree,
        guideSectionId: "join-the-dots",
        branch: { ...branch, id: "branch_2" },
      }),
    ).toThrow("Guide Section not found.");
  });

  it("deletes a Branch and reports the removed Branch", () => {
    const result = deleteBranchFromCultureTree(tree, "branch_1");

    expect(result.tree.items).toEqual([]);
    expect(result.removedBranches).toEqual([branch]);
    expect(countRemovedBranches(result.removedBranches)).toBe(1);
  });

  it("deletes a Branch from its Guide Section without affecting unrelated sections", () => {
    const result = deleteBranchFromCultureTree(guideTree, "similar_1");

    expect(result.removedBranches).toEqual([
      { ...branch, id: "similar_1", branchRole: "similar-appetite" },
    ]);
    expect(result.tree.items.map((item) => item.id)).toEqual(["start_1", "sideways_1", "deep_1"]);
    expect(result.tree.guideSections).toMatchObject([
      { id: "start-here", items: [{ id: "start_1" }] },
      { id: "more-like-this", items: [] },
      { id: "go-sideways", items: [{ id: "sideways_1" }] },
      { id: "go-deeper", items: [{ id: "deep_1" }] },
    ]);
  });

  it("rejects deleting a Branch that is not in the Culture Tree", () => {
    expect(() => deleteBranchFromCultureTree(guideTree, "missing")).toThrow("Branch not found.");
  });

  it("removes enrichment data for every deleted Branch", () => {
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
