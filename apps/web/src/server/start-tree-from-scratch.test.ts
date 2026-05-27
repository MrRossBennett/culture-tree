import { describe, expect, it } from "vite-plus/test";

import {
  StartTreeFromScratchInputSchema,
  buildManualCultureTreeDraft,
  buildManualCultureTreeInsert,
} from "./generate-culture-tree";

describe("Start Tree from scratch", () => {
  it("builds a manually authored Culture Tree without a Seed or Guide Sections", () => {
    const tree = buildManualCultureTreeDraft({
      title: "Private canon",
      description: "A hand-built map of references.",
    });

    expect(tree).toMatchObject({
      title: "Private canon",
      description: "A hand-built map of references.",
      guideSections: [],
      items: [],
    });
    expect(tree.seed).toBeUndefined();
    expect(tree.seedType).toBeUndefined();
  });

  it("persists from-scratch trees as ready owner-authored trees without AI generation state", () => {
    const values = buildManualCultureTreeInsert({
      treeId: "tree_123",
      userId: "person_123",
      input: StartTreeFromScratchInputSchema.parse({
        title: "  Private canon  ",
        description: "  A hand-built map of references.  ",
      }),
    });

    expect(values).toMatchObject({
      id: "tree_123",
      userId: "person_123",
      seedQuery: "Private canon",
      depth: "standard",
      tone: "mixed",
      isPublic: false,
      generationStatus: "ready",
      generationRunId: null,
      generationStage: "Ready",
      generationError: null,
      generationFinalData: null,
    });
    expect(values.data).toMatchObject({
      title: "Private canon",
      description: "A hand-built map of references.",
      guideSections: [],
      items: [],
    });
  });
});
