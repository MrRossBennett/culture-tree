import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import type { AddCultureTreeNodeDraft } from "./culture-tree-node-builder";
import { manualAddToTree, type ManualAddToTreeAdapters } from "./manual-add-to-tree";

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
