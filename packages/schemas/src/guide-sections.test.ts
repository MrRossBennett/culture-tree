import { describe, expect, it } from "vite-plus/test";

import {
  addBranchToGuideSection,
  branchForGuideSection,
  cultureTreeWithRevealedBranches,
  filterCultureTreeToNodeTypes,
  guideSectionsIncludeCore,
  removeBranchFromGuideSections,
} from "./guide-sections";
import { CultureTreeSchema, type CultureTree, type TreeItem } from "./tree";

const branch: TreeItem = {
  id: "branch_1",
  name: "Liquid Swords",
  type: "album",
  reason: "Turns noir dread into cold-blooded mythology.",
  connectionType: "spiritual-kin",
  searchHint: { title: "Liquid Swords", creator: "GZA" },
  source: "user",
};

const guideTree: CultureTree = CultureTreeSchema.parse({
  seed: "Ghost Dog",
  seedType: "root",
  guideSections: [
    {
      id: "start-here",
      title: "Start Here",
      items: [{ ...branch, id: "start_1", type: "film", branchRole: "essential-next" }],
    },
    {
      id: "more-like-this",
      title: "More Like This",
      items: [{ ...branch, id: "similar_1", type: "film", branchRole: "similar-appetite" }],
    },
    {
      id: "go-sideways",
      title: "Go Sideways",
      items: [{ ...branch, id: "sideways_1", branchRole: "sideways-path" }],
    },
    {
      id: "go-deeper",
      title: "Go Deeper",
      items: [{ ...branch, id: "deep_1", type: "book", branchRole: "deep-cut" }],
    },
  ],
  items: [
    { ...branch, id: "start_1", type: "film", branchRole: "essential-next" },
    { ...branch, id: "similar_1", type: "film", branchRole: "similar-appetite" },
    { ...branch, id: "sideways_1", branchRole: "sideways-path" },
    { ...branch, id: "deep_1", type: "book", branchRole: "deep-cut" },
  ],
});

describe("Guide Section policy", () => {
  it("assigns the Branch Role for a Guide Section", () => {
    expect(
      branchForGuideSection({
        guideSectionId: "more-like-this",
        branch: { ...branch, branchRole: undefined },
      }),
    ).toMatchObject({ branchRole: "similar-appetite" });
  });

  it("adds and removes Branches through Guide Sections", () => {
    const added = addBranchToGuideSection({
      tree: guideTree,
      guideSectionId: "more-like-this",
      branch: { ...branch, id: "branch_2", name: "Le Samourai", branchRole: undefined },
    });

    expect(added.items.at(-1)).toMatchObject({
      id: "branch_2",
      branchRole: "similar-appetite",
    });
    expect(
      added.guideSections.find((section) => section.id === "more-like-this")?.items.at(-1),
    ).toMatchObject({ id: "branch_2", branchRole: "similar-appetite" });

    const removed = removeBranchFromGuideSections(added, "branch_2");
    expect(removed.items.map((item) => item.id)).toEqual([
      "start_1",
      "similar_1",
      "sideways_1",
      "deep_1",
    ]);
  });

  it("keeps reveal progress guide-shaped", () => {
    const revealed = cultureTreeWithRevealedBranches(guideTree, 2);

    expect(revealed.items.map((item) => item.id)).toEqual(["start_1", "similar_1"]);
    expect(revealed.guideSections).toMatchObject([
      { id: "start-here", items: [{ id: "start_1" }] },
      { id: "more-like-this", items: [{ id: "similar_1" }] },
      { id: "go-sideways", items: [] },
      { id: "go-deeper", items: [] },
    ]);
  });

  it("filters Branches by node type without discarding the core Guide Section shape", () => {
    const filtered = filterCultureTreeToNodeTypes(guideTree, ["film"]);

    expect(guideSectionsIncludeCore(filtered.guideSections)).toBe(true);
    expect(filtered.items.every((item) => item.type === "film")).toBe(true);
    expect(filtered.guideSections).toMatchObject([
      { id: "start-here", items: [{ id: "start_1" }] },
      { id: "more-like-this", items: [{ id: "similar_1" }] },
      { id: "go-sideways", items: [] },
      { id: "go-deeper", items: [] },
    ]);
  });
});
