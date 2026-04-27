import { CultureTreeSchema } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  draftTreeForSeed,
  isGenerationActive,
  isGenerationStale,
  isGenerationTerminal,
  nextRevealItemIndex,
  parseGenerationMetadata,
} from "./progressive-tree-generation-lifecycle";

describe("progressive tree generation lifecycle", () => {
  it("creates a clean canonical draft tree with only the seed", () => {
    const tree = draftTreeForSeed("  Ok Computer  ");

    expect(CultureTreeSchema.parse(tree)).toEqual({
      seed: "Ok Computer",
      seedType: "root",
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
});
