import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  addPublicBranchToTree,
  branchFromPublicTreeBranch,
  type AddPublicBranchToTreeAdapters,
} from "./public-branch-add-to-tree";

const sourceBranch: TreeItem = {
  id: "source_branch_1",
  name: "Le Samourai",
  type: "film",
  year: 1967,
  reason: "A clean line of ritual, solitude, and professional cool.",
  connectionType: "thematic",
  branchRole: "essential-next",
  searchHint: { title: "Le Samourai" },
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  snapshot: {
    name: "Le Samourai",
    type: "film",
    year: 1967,
    image: "https://example.com/le-samourai.jpg",
  },
  source: "ai",
};

const publicSourceTree: CultureTree = CultureTreeSchema.parse({
  title: "Noir rituals",
  items: [sourceBranch],
});

const privateTargetTree: CultureTree = CultureTreeSchema.parse({
  title: "Private canon",
  items: [],
});

const readyGeneration = {
  generationStatus: "ready",
  generationRunId: null,
  generationStage: "Ready",
  generationUpdatedAt: new Date("2026-05-01T00:00:00.000Z"),
  generationError: null,
  generationFinalData: null,
};

function baseAdapters(
  overrides: Partial<AddPublicBranchToTreeAdapters> = {},
): AddPublicBranchToTreeAdapters {
  return {
    loadCultureTree: vi.fn(async (treeId) => {
      if (treeId === "public_tree") {
        return {
          id: "public_tree",
          userId: "owner_1",
          data: publicSourceTree,
          enrichmentData: {
            source_branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
          },
          isPublic: true,
          ...readyGeneration,
        };
      }
      if (treeId === "target_tree") {
        return {
          id: "target_tree",
          userId: "person_1",
          data: privateTargetTree,
          enrichmentData: {},
          isPublic: false,
          ...readyGeneration,
        };
      }
      return null;
    }),
    nextBranchId: vi.fn(() => "copied_branch_1"),
    prepareEnrichments: vi.fn(async ({ currentEnrichments }) => currentEnrichments),
    commitPublicBranchAdd: vi.fn(async () => {}),
    resolveCommittedBranches: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("branchFromPublicTreeBranch", () => {
  it("copies a Public Tree Branch as a manual Branch without Guide Section role", () => {
    expect(
      branchFromPublicTreeBranch({
        branch: sourceBranch,
        id: "copied_branch_1",
      }),
    ).toMatchObject({
      id: "copied_branch_1",
      name: "Le Samourai",
      reason: "A clean line of ritual, solitude, and professional cool.",
      source: "user",
      identity: sourceBranch.identity,
      snapshot: sourceBranch.snapshot,
    });
    expect(
      branchFromPublicTreeBranch({
        branch: sourceBranch,
        id: "copied_branch_1",
      }).branchRole,
    ).toBeUndefined();
  });
});

describe("addPublicBranchToTree", () => {
  it("adds a Branch from someone else's Public Tree to one of the person's own trees", async () => {
    const adapters = baseAdapters();

    const result = await addPublicBranchToTree({
      sourceTreeId: "public_tree",
      sourceBranchId: "source_branch_1",
      targetTreeId: "target_tree",
      person: { id: "person_1", email: "person@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branch: {
        id: "copied_branch_1",
        name: "Le Samourai",
        source: "user",
      },
      branchCount: 1,
    });
    expect(result.branch.branchRole).toBeUndefined();
    expect(adapters.commitPublicBranchAdd).toHaveBeenCalledWith({
      treeId: "target_tree",
      tree: expect.objectContaining({
        items: [expect.objectContaining({ id: "copied_branch_1" })],
      }),
      enrichments: {
        copied_branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
      },
    });
  });

  it("adds a Branch from one of the person's own (private) trees to another of their trees", async () => {
    const adapters = baseAdapters({
      loadCultureTree: vi.fn(async (treeId) => {
        const row = await baseAdapters().loadCultureTree(treeId);
        return row && treeId === "public_tree"
          ? { ...row, userId: "person_1", isPublic: false }
          : row;
      }),
    });

    const result = await addPublicBranchToTree({
      sourceTreeId: "public_tree",
      sourceBranchId: "source_branch_1",
      targetTreeId: "target_tree",
      person: { id: "person_1" },
      adapters,
    });

    expect(result).toMatchObject({ ok: true, branch: { id: "copied_branch_1" } });
    expect(adapters.commitPublicBranchAdd).toHaveBeenCalledTimes(1);
  });

  it("does not consult or record AI Generation allowance", async () => {
    const adapters = baseAdapters();

    await addPublicBranchToTree({
      sourceTreeId: "public_tree",
      sourceBranchId: "source_branch_1",
      targetTreeId: "target_tree",
      person: { id: "person_1" },
      adapters,
    });

    expect(adapters.commitPublicBranchAdd).toHaveBeenCalledTimes(1);
  });

  it("rejects another person's Private source trees and non-owned target trees", async () => {
    await expect(
      addPublicBranchToTree({
        sourceTreeId: "public_tree",
        sourceBranchId: "source_branch_1",
        targetTreeId: "target_tree",
        person: { id: "person_1" },
        adapters: baseAdapters({
          loadCultureTree: vi.fn(async (treeId) => {
            const row = await baseAdapters().loadCultureTree(treeId);
            return row && treeId === "public_tree" ? { ...row, isPublic: false } : row;
          }),
        }),
      }),
    ).rejects.toThrow("Source tree not found");

    await expect(
      addPublicBranchToTree({
        sourceTreeId: "public_tree",
        sourceBranchId: "source_branch_1",
        targetTreeId: "target_tree",
        person: { id: "person_1" },
        adapters: baseAdapters({
          loadCultureTree: vi.fn(async (treeId) => {
            const row = await baseAdapters().loadCultureTree(treeId);
            return row && treeId === "target_tree" ? { ...row, userId: "person_2" } : row;
          }),
        }),
      }),
    ).rejects.toThrow("Target tree not found");
  });
});
