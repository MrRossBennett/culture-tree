import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import { loaderContainsCommittedTree, treeForVisiblePreview } from "./tree-preview-state";

const loaderTree: CultureTree = CultureTreeSchema.parse({
  title: "Private canon",
  items: [],
});

const addedBranch: TreeItem = {
  id: "branch_1",
  name: "Le Samourai",
  type: "film",
  reason: "",
  connectionType: "thematic",
  searchHint: { title: "Le Samourai" },
  source: "user",
};

describe("treeForVisiblePreview", () => {
  it("keeps a committed manual Branch visible while loader data catches up", () => {
    const committedTree = CultureTreeSchema.parse({
      title: "Private canon",
      items: [addedBranch],
    });

    expect(
      treeForVisiblePreview({
        loaderTree,
        committedTree,
        pendingItems: [],
      }).items,
    ).toEqual([addedBranch]);
  });

  it("still shows pending Branches before the server commit completes", () => {
    expect(
      treeForVisiblePreview({
        loaderTree,
        committedTree: null,
        pendingItems: [addedBranch],
      }).items,
    ).toEqual([addedBranch]);
  });

  it("detects when loader data has caught up with the committed Branch", () => {
    const committedTree = CultureTreeSchema.parse({
      title: "Private canon",
      items: [addedBranch],
    });

    expect(loaderContainsCommittedTree({ loaderTree, committedTree })).toBe(false);
    expect(
      loaderContainsCommittedTree({
        loaderTree: committedTree,
        committedTree,
      }),
    ).toBe(true);
  });

  it("does not treat an empty committed tree as caught up", () => {
    expect(
      loaderContainsCommittedTree({
        loaderTree,
        committedTree: loaderTree,
      }),
    ).toBe(false);
  });
});
