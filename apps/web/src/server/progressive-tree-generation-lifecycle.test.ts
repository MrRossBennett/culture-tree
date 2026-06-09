import { CultureTreeSchema } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  draftTreeForSeed,
  isGenerationActive,
  isGenerationStale,
  isGenerationTerminal,
  nextRevealItemIndex,
  parseGenerationMetadata,
  treeForRevealProgress,
} from "./progressive-tree-generation-lifecycle";

describe("progressive tree generation lifecycle", () => {
  it("creates a clean canonical draft tree with only the seed", () => {
    const tree = draftTreeForSeed("  Ok Computer  ");

    expect(CultureTreeSchema.parse(tree)).toEqual({
      seed: "Ok Computer",
      seedType: "root",
      guideSections: [],
      items: [],
    });
  });

  it("keeps incomplete generation metadata outside canonical tree items", () => {
    const tree = draftTreeForSeed("Grimy New York 70s");
    const metadata = parseGenerationMetadata({
      generationStatus: "running",
      generationRunId: "run_123",
      generationStage: "Planning the shape of the tree",
      generationUpdatedAt: new Date("2026-04-27T12:00:00.000Z"),
      generationError: null,
      generationFinalData: null,
    });

    expect(tree.items).toHaveLength(0);
    expect(metadata).toMatchObject({
      status: "running",
      runId: "run_123",
      stage: "Planning the shape of the tree",
      hasFinalResult: false,
    });
    expect(JSON.stringify(tree)).not.toContain("Planning the shape of the tree");
    expect(JSON.stringify(tree)).not.toContain("run_123");
  });

  it("distinguishes active, terminal, and stale generation states", () => {
    const now = new Date("2026-04-27T12:06:00.000Z");

    expect(isGenerationActive("queued")).toBe(true);
    expect(isGenerationActive("revealing")).toBe(true);
    expect(isGenerationTerminal("ready")).toBe(true);
    expect(isGenerationTerminal("failed")).toBe(true);
    expect(
      isGenerationStale(
        { status: "running", updatedAt: new Date("2026-04-27T12:00:00.000Z") },
        now,
      ),
    ).toBe(true);
    expect(
      isGenerationStale(
        { status: "running", updatedAt: new Date("2026-04-27T12:04:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isGenerationStale({ status: "failed", updatedAt: new Date("2026-04-27T12:00:00.000Z") }, now),
    ).toBe(false);
  });

  it("reveals the next final-result item after already committed canonical items", () => {
    expect(nextRevealItemIndex(0)).toBe(0);
    expect(nextRevealItemIndex(3)).toBe(3);
  });

  it("keeps reveal progress guide-shaped, then returns the final tree when complete", () => {
    const finalTree = CultureTreeSchema.parse({
      seed: "Ghost Dog",
      seedType: "root",
      guideSections: [
        {
          id: "start-here",
          title: "Start Here",
          items: [
            {
              id: "item_1",
              name: "Le Samourai",
              type: "film",
              reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
              connectionType: "influence",
              branchRole: "essential-next",
              searchHint: { title: "Le Samourai" },
              source: "ai",
            },
          ],
        },
        {
          id: "more-like-this",
          title: "More Like This",
          items: [
            {
              id: "item_2",
              name: "Branded to Kill",
              type: "film",
              reason: "A stranger variation on hitman cool and dream logic.",
              connectionType: "spiritual-kin",
              branchRole: "similar-appetite",
              searchHint: { title: "Branded to Kill" },
              source: "ai",
            },
          ],
        },
        {
          id: "go-sideways",
          title: "Go Sideways",
          items: [
            {
              id: "item_3",
              name: "Liquid Swords",
              type: "album",
              reason: "Moves the same lone-warrior code into icy street mythology.",
              connectionType: "spiritual-kin",
              branchRole: "sideways-path",
              searchHint: { title: "Liquid Swords", creator: "GZA" },
              source: "ai",
            },
          ],
        },
        {
          id: "go-deeper",
          title: "Go Deeper",
          items: [
            {
              id: "item_4",
              name: "A Colt Is My Passport",
              type: "film",
              reason: "A leaner, stranger route into the same assassin fatalism.",
              connectionType: "contemporary",
              branchRole: "deep-cut",
              searchHint: { title: "A Colt Is My Passport" },
              source: "ai",
            },
          ],
        },
      ],
      items: [
        {
          id: "item_1",
          name: "Le Samourai",
          type: "film",
          reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
          connectionType: "influence",
          branchRole: "essential-next",
          searchHint: { title: "Le Samourai" },
          source: "ai",
        },
        {
          id: "item_2",
          name: "Branded to Kill",
          type: "film",
          reason: "A stranger variation on hitman cool and dream logic.",
          connectionType: "spiritual-kin",
          branchRole: "similar-appetite",
          searchHint: { title: "Branded to Kill" },
          source: "ai",
        },
        {
          id: "item_3",
          name: "Liquid Swords",
          type: "album",
          reason: "Moves the same lone-warrior code into icy street mythology.",
          connectionType: "spiritual-kin",
          branchRole: "sideways-path",
          searchHint: { title: "Liquid Swords", creator: "GZA" },
          source: "ai",
        },
        {
          id: "item_4",
          name: "A Colt Is My Passport",
          type: "film",
          reason: "A leaner, stranger route into the same assassin fatalism.",
          connectionType: "contemporary",
          branchRole: "deep-cut",
          searchHint: { title: "A Colt Is My Passport" },
          source: "ai",
        },
      ],
    });

    expect(treeForRevealProgress(finalTree, 2)).toMatchObject({
      guideSections: [
        { id: "start-here", items: [{ id: "item_1" }] },
        { id: "more-like-this", items: [{ id: "item_2" }] },
        { id: "go-sideways", items: [] },
        { id: "go-deeper", items: [] },
      ],
      items: [{ id: "item_1" }, { id: "item_2" }],
    });
    expect(treeForRevealProgress(finalTree, finalTree.items.length).guideSections).toHaveLength(4);
  });
});
