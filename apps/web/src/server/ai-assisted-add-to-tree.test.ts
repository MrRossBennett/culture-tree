import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import {
  CultureTreeSchema,
  type CultureTree,
  type ExternalNodeSearchResult,
  type TreeItem,
} from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  suggestBranchesForAddToTree,
  type SuggestBranchesForAddToTreeAdapters,
} from "./ai-assisted-add-to-tree";

const allowancePeriod = {
  start: new Date("2026-05-01T00:00:00.000Z"),
  end: new Date("2026-06-01T00:00:00.000Z"),
};

const existingBranch: TreeItem = {
  id: "branch_1",
  name: "Le Samourai",
  type: "film",
  year: 1967,
  reason: "",
  connectionType: "thematic",
  searchHint: { title: "Le Samourai" },
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  source: "user",
};

const tree: CultureTree = CultureTreeSchema.parse({
  title: "Private canon",
  items: [existingBranch],
});

function result(name: string, externalId: string, year: number): ExternalNodeSearchResult {
  return {
    kind: "addable-work",
    identity: { source: "wikipedia", externalId },
    snapshot: { name, type: "film", year },
    searchHint: { title: name },
    externalUrl: `https://example.com/${externalId}`,
  };
}

const stagedResult = result("The Warriors", "The_Warriors", 1979);
const cleanResult = result("Ghost Dog", "Ghost_Dog", 1999);
const secondCleanResult = result("Branded to Kill", "Branded_to_Kill", 1967);

function candidate(name: string, year: number): TreeItem {
  return {
    id: name.toLowerCase().replaceAll(" ", "_"),
    name,
    type: "film",
    year,
    reason: "",
    connectionType: "thematic",
    searchHint: { title: name },
    source: "ai",
  };
}

function baseAdapters(
  overrides: Partial<SuggestBranchesForAddToTreeAdapters> = {},
): SuggestBranchesForAddToTreeAdapters {
  return {
    loadCultureTree: vi.fn(async () => ({
      id: "tree_1",
      userId: "person_1",
      data: tree,
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
    suggestCandidateBranches: vi.fn(async () => [
      candidate("Le Samourai", 1967),
      candidate("The Warriors", 1979),
      candidate("Ghost Dog", 1999),
      candidate("Branded to Kill", 1967),
    ]),
    recognizeCandidate: vi.fn(async (item) => {
      if (item.name === "Le Samourai") return result("Le Samourai", "Le_Samourai", 1967);
      if (item.name === "The Warriors") return stagedResult;
      if (item.name === "Ghost Dog") return cleanResult;
      if (item.name === "Branded to Kill") return secondCleanResult;
      return null;
    }),
    recordSuggestionUsage: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("suggestBranchesForAddToTree", () => {
  it("returns clean AI suggestions deduped against the tree and tray", async () => {
    const adapters = baseAdapters();

    const response = await suggestBranchesForAddToTree({
      treeId: "tree_1",
      trayResults: [stagedResult],
      person: { id: "person_1", email: "owner@example.com" },
      adapters,
    });

    expect(response).toMatchObject({
      ok: true,
      suggestions: [cleanResult, secondCleanResult],
    });
    expect(adapters.recordSuggestionUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        treeId: "tree_1",
        person: { id: "person_1", email: "owner@example.com" },
        allowance: expect.objectContaining({ allowed: true }),
        allowancePeriod,
      }),
    );
  });

  it("limits suggestions to available tray slots", async () => {
    const trayResults = Array.from({ length: 11 }, (_, index) =>
      result(`Tray ${index}`, `Tray_${index}`, 2000 + index),
    );
    const adapters = baseAdapters({
      suggestCandidateBranches: vi.fn(async () => [
        candidate("Ghost Dog", 1999),
        candidate("Branded to Kill", 1967),
      ]),
    });

    const response = await suggestBranchesForAddToTree({
      treeId: "tree_1",
      trayResults,
      person: { id: "person_1" },
      adapters,
    });

    expect(response.ok ? response.suggestions : []).toEqual([cleanResult]);
  });

  it("returns limit reached before suggesting or recording usage", async () => {
    const adapters = baseAdapters({
      decideAllowance: vi.fn(async () => ({
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
      })),
    });

    const response = await suggestBranchesForAddToTree({
      treeId: "tree_1",
      trayResults: [],
      person: { id: "person_1" },
      adapters,
    });

    expect(response).toMatchObject({ ok: false });
    expect(adapters.suggestCandidateBranches).not.toHaveBeenCalled();
    expect(adapters.recordSuggestionUsage).not.toHaveBeenCalled();
  });

  it("rejects suggestions for a non-Owner", async () => {
    await expect(
      suggestBranchesForAddToTree({
        treeId: "tree_1",
        trayResults: [],
        person: { id: "person_2" },
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("Tree not found");
  });
});
