import { CORE_RECOMMENDATION_GUIDE_SECTION_IDS, GUIDE_SECTION_DISPLAY_ORDER } from "@repo/schemas";
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

  it("returns a generated tree with recommendation Guide Sections when MOCK_ENGINE is enabled", async () => {
    process.env.MOCK_ENGINE = "true";

    const tree = await generateTree({
      query: "OK Computer — Radiohead",
      depth: "standard",
      tone: "mixed",
    });

    expect(tree.seed).toBe("OK Computer — Radiohead");
    const sectionIds = tree.guideSections.map((section) => section.id);
    expect(sectionIds).toEqual(GUIDE_SECTION_DISPLAY_ORDER);
    expect(CORE_RECOMMENDATION_GUIDE_SECTION_IDS.every((id) => sectionIds.includes(id))).toBe(true);
    expect(
      tree.guideSections.every((section) => section.items.every((item) => item.branchRole != null)),
    ).toBe(true);
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
    expect(
      CORE_RECOMMENDATION_GUIDE_SECTION_IDS.every((id) =>
        tree.guideSections.some((section) => section.id === id),
      ),
    ).toBe(true);
    expect(tree.items.every((item) => item.type === "film")).toBe(true);
    expect(
      tree.guideSections.every((section) => section.items.every((item) => item.type === "film")),
    ).toBe(true);
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
