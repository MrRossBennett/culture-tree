import { afterEach, describe, expect, it } from "vite-plus/test";

import { completeTreeItemConnection, generateTree } from "./pipeline";

const previousMockEngine = process.env.MOCK_ENGINE;

describe("generateTree", () => {
  afterEach(() => {
    if (previousMockEngine == null) {
      delete process.env.MOCK_ENGINE;
    } else {
      process.env.MOCK_ENGINE = previousMockEngine;
    }
  });

  it("returns a tree with Start Here Guide Sections when MOCK_ENGINE is enabled", async () => {
    process.env.MOCK_ENGINE = "true";

    const tree = await generateTree({
      query: "OK Computer — Radiohead",
      depth: "standard",
      tone: "mixed",
    });

    expect(tree.seed).toBe("OK Computer — Radiohead");
    expect(tree.guideSections[0]).toMatchObject({
      id: "start-here",
      title: "Start Here",
    });
    expect(tree.guideSections[0]?.items.length).toBeGreaterThan(0);
    expect(tree.guideSections[0]?.items.every((item) => item.branchRole === "essential-next")).toBe(
      true,
    );
    expect(tree.items.length).toBeGreaterThan(0);
    expect(tree.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.any(String),
      reason: expect.any(String),
      connectionType: expect.any(String),
      branchRole: "essential-next",
      source: "ai",
    });
    expect("children" in tree.items[0]).toBe(false);
  });

  it("respects media filters when MOCK_ENGINE is enabled", async () => {
    process.env.MOCK_ENGINE = "true";

    const tree = await generateTree({
      query: "Jaws",
      depth: "standard",
      tone: "mixed",
      mediaFilter: ["film"],
    });

    expect(tree.items.length).toBeGreaterThan(0);
    expect(tree.items.every((item) => item.type === "film")).toBe(true);
  });

  it("fills an added tree item reason when MOCK_ENGINE is enabled", async () => {
    process.env.MOCK_ENGINE = "true";

    const item = await completeTreeItemConnection(
      {
        seed: "Grimy New York 70s",
        seedType: "root",
        guideSections: [],
        items: [],
      },
      {
        id: "new-item",
        name: "Television — Marquee Moon",
        type: "album",
        reason: "",
        connectionType: "thematic",
        searchHint: { title: "Marquee Moon", creator: "Television" },
        source: "user",
      },
    );

    expect(item.reason).toContain("Grimy New York 70s");
  });
});
