import { CultureTreeSchema, type CultureTree } from "@repo/schemas";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  addLikedBranchToTree,
  branchFromLikedEntity,
  type AddLikedBranchToTreeAdapters,
} from "./liked-branch-add-to-tree";

const targetTree: CultureTree = CultureTreeSchema.parse({
  title: "Private canon",
  items: [],
});

const likedEntity = {
  id: "entity_1",
  type: "film",
  name: "Le Samourai",
  year: 1967,
  imageUrl: "https://example.com/le-samourai.jpg",
  primaryExternalSource: "wikipedia",
  primaryExternalId: "Le_Samourai",
};

function baseAdapters(
  overrides: Partial<AddLikedBranchToTreeAdapters> = {},
): AddLikedBranchToTreeAdapters {
  return {
    loadTargetTree: vi.fn(async () => ({
      id: "target_tree",
      userId: "person_1",
      data: targetTree,
      enrichmentData: {},
    })),
    loadLikedEntity: vi.fn(async () => likedEntity),
    nextBranchId: vi.fn(() => "liked_branch_1"),
    prepareEnrichments: vi.fn(async () => ({
      liked_branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
    })),
    commitLikedBranchAdd: vi.fn(async () => {}),
    resolveCommittedBranches: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("branchFromLikedEntity", () => {
  it("turns a liked recognized subject into a manual Branch draft", () => {
    expect(branchFromLikedEntity({ entity: likedEntity, id: "liked_branch_1" })).toMatchObject({
      id: "liked_branch_1",
      name: "Le Samourai",
      type: "film",
      year: 1967,
      reason: "",
      connectionType: "thematic",
      identity: { source: "wikipedia", externalId: "Le_Samourai" },
      snapshot: {
        name: "Le Samourai",
        type: "film",
        year: 1967,
        image: "https://example.com/le-samourai.jpg",
      },
      source: "user",
    });
  });
});

describe("addLikedBranchToTree", () => {
  it("adds a liked Branch to one of the person's own trees without Tree Creation usage", async () => {
    const adapters = baseAdapters();

    const result = await addLikedBranchToTree({
      entityId: "entity_1",
      targetTreeId: "target_tree",
      person: { id: "person_1", email: "person@example.com" },
      adapters,
    });

    expect(result).toMatchObject({
      ok: true,
      branch: {
        id: "liked_branch_1",
        name: "Le Samourai",
        source: "user",
      },
      branchCount: 1,
    });
    expect(adapters.loadLikedEntity).toHaveBeenCalledWith({
      entityId: "entity_1",
      userId: "person_1",
    });
    expect(adapters.commitLikedBranchAdd).toHaveBeenCalledWith({
      treeId: "target_tree",
      tree: expect.objectContaining({
        items: [expect.objectContaining({ id: "liked_branch_1" })],
      }),
      enrichments: {
        liked_branch_1: { coverUrl: "https://example.com/le-samourai.jpg" },
      },
    });
  });

  it("requires the target tree to be owned by the liker", async () => {
    await expect(
      addLikedBranchToTree({
        entityId: "entity_1",
        targetTreeId: "target_tree",
        person: { id: "person_1" },
        adapters: baseAdapters({
          loadTargetTree: vi.fn(async () => ({
            id: "target_tree",
            userId: "person_2",
            data: targetTree,
            enrichmentData: {},
          })),
        }),
      }),
    ).rejects.toThrow("Target tree not found");
  });

  it("requires the entity to have been liked by the person", async () => {
    await expect(
      addLikedBranchToTree({
        entityId: "entity_1",
        targetTreeId: "target_tree",
        person: { id: "person_1" },
        adapters: baseAdapters({
          loadLikedEntity: vi.fn(async () => null),
        }),
      }),
    ).rejects.toThrow("Liked Branch not found");
  });
});
