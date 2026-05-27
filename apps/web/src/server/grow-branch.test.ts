import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import type { AddCultureTreeNodeDraft } from "./culture-tree-node-builder";
import { growBranch, type GrowBranchAdapters } from "./grow-branch";

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

const draft: AddCultureTreeNodeDraft = {
  kind: "concept",
  name: "Le Samourai",
  type: "film",
  connectionType: "influence",
  reason: "",
};

const allowancePeriod = {
  start: new Date("2026-05-01T00:00:00.000Z"),
  end: new Date("2026-06-01T00:00:00.000Z"),
};

function baseAdapters(overrides: Partial<GrowBranchAdapters> = {}): GrowBranchAdapters {
  return {
    loadCultureTree: vi.fn(async () => ({
      id: "tree_1",
      userId: "person_1",
      data: guideTree,
      enrichmentData: { similar_1: { coverUrl: "https://example.com/liquid-swords.jpg" } },
    })),
    decideAllowance: vi.fn(async () => ({
      allowance: {
        allowed: true as const,
        effectivePlan: PLANS.free,
        usageType: ENTITLEMENTS.growBranch,
        remaining: 2,
      },
      allowancePeriod,
    })),
    buildBranch: vi.fn(
      (_node: AddCultureTreeNodeDraft): TreeItem => ({
        ...branch,
        id: "branch_2",
        name: "Le Samourai",
        type: "film" as const,
        reason: "",
        connectionType: "influence" as const,
        searchHint: { title: "Le Samourai" },
      }),
    ),
    completeBranchConnection: vi.fn(async (_tree, inputBranch) => ({
      ...inputBranch,
      reason: "A precise next stop for ritual, restraint, and lone-hitman fatalism.",
    })),
    prepareEnrichments: vi.fn(async ({ currentEnrichments }) => ({
      ...currentEnrichments,
      branch_2: { coverUrl: "https://example.com/le-samourai.jpg" },
    })),
    commitAcceptedGrowBranch: vi.fn(async () => {}),
    resolveCommittedBranches: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("growBranch", () => {
  it("owns the accepted Grow Branch workflow behind one interface", async () => {
    const adapters = baseAdapters();

    const result = await growBranch({
      treeId: "tree_1",
      guideSectionId: "more-like-this",
      node: draft,
      person: { id: "person_1", email: "owner@example.com" },
      proAllowlist: "owner@example.com",
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branch: {
        id: "branch_2",
        branchRole: "similar-appetite",
        reason: "A precise next stop for ritual, restraint, and lone-hitman fatalism.",
      },
      branchCount: 5,
    });
    expect(adapters.decideAllowance).toHaveBeenCalledWith({
      person: { id: "person_1", email: "owner@example.com" },
      cultureTreeId: "tree_1",
      proAllowlist: "owner@example.com",
    });
    expect(adapters.prepareEnrichments).toHaveBeenCalledWith({
      tree: guideTree,
      branches: [
        expect.objectContaining({
          id: "branch_2",
          reason: "A precise next stop for ritual, restraint, and lone-hitman fatalism.",
        }),
      ],
      currentEnrichments: {
        similar_1: { coverUrl: "https://example.com/liquid-swords.jpg" },
      },
    });
    expect(adapters.commitAcceptedGrowBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        treeId: "tree_1",
        tree: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ id: "branch_2", branchRole: "similar-appetite" }),
          ]),
        }),
        enrichments: expect.objectContaining({
          branch_2: { coverUrl: "https://example.com/le-samourai.jpg" },
        }),
        allowance: expect.objectContaining({ allowed: true }),
        allowancePeriod,
      }),
    );
    expect(adapters.resolveCommittedBranches).toHaveBeenCalledWith({
      treeId: "tree_1",
      branches: [expect.objectContaining({ id: "branch_2" })],
      enrichments: expect.objectContaining({
        branch_2: { coverUrl: "https://example.com/le-samourai.jpg" },
      }),
    });
  });

  it("returns Limit Reached before building or committing a Branch", async () => {
    const adapters = baseAdapters({
      decideAllowance: vi.fn(
        async (): ReturnType<GrowBranchAdapters["decideAllowance"]> => ({
          allowance: {
            allowed: false as const,
            effectivePlan: PLANS.free,
            limitReached: {
              code: "limit_reached" as const,
              allowance: "free_per_tree_grow_branch" as const,
              usageType: ENTITLEMENTS.growBranch,
              limit: 3,
              used: 3,
              remaining: 0 as const,
              message: "Free Plan includes 3 Grow Branch actions per Culture Tree.",
            },
          },
          allowancePeriod,
        }),
      ),
    });

    const result = await growBranch({
      treeId: "tree_1",
      guideSectionId: "more-like-this",
      node: draft,
      person: { id: "person_1", email: "owner@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: false,
      limitReached: {
        allowance: "free_per_tree_grow_branch",
        message:
          "You've used the 3 Grow Branch actions included for this Culture Tree. Pro access is not self-serve yet, but this is the paid boundary.",
      },
    });
    expect(adapters.buildBranch).not.toHaveBeenCalled();
    expect(adapters.commitAcceptedGrowBranch).not.toHaveBeenCalled();
    expect(adapters.resolveCommittedBranches).not.toHaveBeenCalled();
  });

  it("can add an AI-assisted Branch without Guide Sections while recording Grow Branch usage", async () => {
    const manualTree = CultureTreeSchema.parse({
      title: "Private canon",
      items: [],
    });
    const adapters = baseAdapters({
      loadCultureTree: vi.fn(async () => ({
        id: "tree_1",
        userId: "person_1",
        data: manualTree,
        enrichmentData: {},
      })),
    });

    const result = await growBranch({
      treeId: "tree_1",
      node: draft,
      person: { id: "person_1", email: "owner@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branch: {
        id: "branch_2",
        reason: "A precise next stop for ritual, restraint, and lone-hitman fatalism.",
      },
      branchCount: 1,
    });
    expect(result.ok ? result.branch.branchRole : "not-ok").toBeUndefined();
    expect(adapters.decideAllowance).toHaveBeenCalledWith({
      person: { id: "person_1", email: "owner@example.com" },
      cultureTreeId: "tree_1",
      proAllowlist: undefined,
    });
    expect(adapters.commitAcceptedGrowBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        treeId: "tree_1",
        tree: expect.objectContaining({
          guideSections: [],
          items: [expect.objectContaining({ id: "branch_2" })],
        }),
        allowance: expect.objectContaining({
          allowed: true,
          usageType: ENTITLEMENTS.growBranch,
        }),
      }),
    );
  });

  it("rejects Grow Branch for a non-Owner", async () => {
    await expect(
      growBranch({
        treeId: "tree_1",
        guideSectionId: "more-like-this",
        node: draft,
        person: { id: "person_2" },
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("Tree not found");
  });
});
