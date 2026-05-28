import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import type { AddCultureTreeNodeDraft } from "./culture-tree-node-builder";
import {
  manualAddBranchesToTree,
  manualAddToTree,
  type ManualAddToTreeAdapters,
} from "./manual-add-to-tree";

const manualTree: CultureTree = CultureTreeSchema.parse({
  title: "Private canon",
  items: [],
});

const searchResultDraft: AddCultureTreeNodeDraft = {
  kind: "search-result",
  connectionType: "thematic",
  reason: "",
  result: {
    identity: { source: "wikipedia", externalId: "Le_Samourai" },
    snapshot: {
      name: "Le Samourai",
      type: "film",
      year: 1967,
      image: "https://example.com/le-samourai.jpg",
    },
    searchHint: { title: "Le Samourai" },
    externalUrl: "https://example.com/le-samourai",
  },
};

const branch: TreeItem = {
  id: "branch_1",
  name: "Le Samourai",
  type: "film",
  year: 1967,
  reason: "",
  connectionType: "thematic",
  searchHint: { title: "Le Samourai" },
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  snapshot: searchResultDraft.result.snapshot,
  source: "user",
};

const secondSearchResultDraft: AddCultureTreeNodeDraft = {
  kind: "search-result",
  connectionType: "thematic",
  reason: "",
  result: {
    identity: { source: "wikipedia", externalId: "The_Warriors" },
    snapshot: {
      name: "The Warriors",
      type: "film",
      year: 1979,
      image: "https://example.com/the-warriors.jpg",
    },
    searchHint: { title: "The Warriors" },
    externalUrl: "https://example.com/the-warriors",
  },
};

const secondBranch: TreeItem = {
  id: "branch_2",
  name: "The Warriors",
  type: "film",
  year: 1979,
  reason: "",
  connectionType: "thematic",
  searchHint: { title: "The Warriors" },
  identity: { source: "wikipedia", externalId: "The_Warriors" },
  snapshot: secondSearchResultDraft.result.snapshot,
  source: "user",
};

function baseAdapters(overrides: Partial<ManualAddToTreeAdapters> = {}): ManualAddToTreeAdapters {
  return {
    loadCultureTree: vi.fn(async () => ({
      id: "tree_1",
      userId: "person_1",
      data: manualTree,
      enrichmentData: {},
    })),
    buildBranch: vi.fn(() => branch),
    prepareEnrichments: vi.fn(async () => ({
      branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
    })),
    commitManualAddToTree: vi.fn(async () => {}),
    resolveCommittedBranches: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("manualAddToTree", () => {
  it("turns a recognized search result into a manual Branch without AI connection text", async () => {
    const adapters = baseAdapters();

    const result = await manualAddToTree({
      treeId: "tree_1",
      node: searchResultDraft,
      person: { id: "person_1", email: "owner@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branch: {
        id: "branch_1",
        name: "Le Samourai",
        type: "film",
        reason: "",
      },
      branchCount: 1,
    });
    expect(result.branch.branchRole).toBeUndefined();
    expect(adapters.buildBranch).toHaveBeenCalledWith(searchResultDraft);
    expect(adapters.commitManualAddToTree).toHaveBeenCalledWith({
      treeId: "tree_1",
      tree: expect.objectContaining({
        items: [expect.objectContaining({ id: "branch_1", reason: "" })],
      }),
      enrichments: {
        branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
      },
    });
  });

  it("does not consult or record AI Generation allowance", async () => {
    const adapters = baseAdapters();

    await manualAddToTree({
      treeId: "tree_1",
      node: searchResultDraft,
      person: { id: "person_1" },
      adapters,
    });

    expect(adapters.commitManualAddToTree).toHaveBeenCalledTimes(1);
  });

  it("rejects manual Add to Tree for a non-Owner", async () => {
    await expect(
      manualAddToTree({
        treeId: "tree_1",
        node: searchResultDraft,
        person: { id: "person_2" },
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("Tree not found");
  });
});

describe("manualAddBranchesToTree", () => {
  it("adds multiple manual Branches to an owned Culture Tree atomically", async () => {
    const adapters = baseAdapters({
      buildBranch: vi.fn((node) =>
        node.result.identity.externalId === "The_Warriors" ? secondBranch : branch,
      ),
      prepareEnrichments: vi.fn(async () => ({
        branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
        branch_2: { coverUrl: "https://example.com/the-warriors.jpg" },
      })),
    });

    const result = await manualAddBranchesToTree({
      treeId: "tree_1",
      nodes: [searchResultDraft, secondSearchResultDraft],
      person: { id: "person_1", email: "owner@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branches: [
        { id: "branch_1", name: "Le Samourai", reason: "" },
        { id: "branch_2", name: "The Warriors", reason: "" },
      ],
      branchCount: 2,
    });
    expect(adapters.commitManualAddToTree).toHaveBeenCalledTimes(1);
    expect(adapters.commitManualAddToTree).toHaveBeenCalledWith({
      treeId: "tree_1",
      tree: expect.objectContaining({
        items: [
          expect.objectContaining({ id: "branch_1" }),
          expect.objectContaining({ id: "branch_2" }),
        ],
      }),
      enrichments: {
        branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
        branch_2: { coverUrl: "https://example.com/the-warriors.jpg" },
      },
    });
  });

  it("rejects multi-Branch Add to Tree for a non-Owner", async () => {
    await expect(
      manualAddBranchesToTree({
        treeId: "tree_1",
        nodes: [searchResultDraft, secondSearchResultDraft],
        person: { id: "person_2" },
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("Tree not found");
  });

  it("does not commit a partial tree when batch preparation fails", async () => {
    const adapters = baseAdapters({
      buildBranch: vi.fn((node) =>
        node.result.identity.externalId === "The_Warriors" ? secondBranch : branch,
      ),
      prepareEnrichments: vi.fn(async () => {
        throw new Error("Could not prepare enrichments.");
      }),
    });

    await expect(
      manualAddBranchesToTree({
        treeId: "tree_1",
        nodes: [searchResultDraft, secondSearchResultDraft],
        person: { id: "person_1" },
        adapters,
      }),
    ).rejects.toThrow("Could not prepare enrichments.");
    expect(adapters.commitManualAddToTree).not.toHaveBeenCalled();
    expect(adapters.resolveCommittedBranches).not.toHaveBeenCalled();
  });
});
