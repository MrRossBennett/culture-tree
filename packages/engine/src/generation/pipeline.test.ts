import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateTree } from "./pipeline";

const previousMockEngine = process.env.MOCK_ENGINE;

describe("generateTree", () => {
  afterEach(() => {
    if (previousMockEngine == null) {
      delete process.env.MOCK_ENGINE;
    } else {
      process.env.MOCK_ENGINE = previousMockEngine;
    }
  });

  it("returns a flat tree with items when MOCK_ENGINE is enabled", async () => {
    process.env.MOCK_ENGINE = "true";

    const tree = await generateTree({
      query: "OK Computer — Radiohead",
      depth: "standard",
      tone: "mixed",
    });

    expect(tree.seed).toBe("OK Computer — Radiohead");
    expect(tree.items.length).toBeGreaterThan(0);
    expect(tree.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.any(String),
      reason: expect.any(String),
      connectionType: expect.any(String),
      source: "ai",
    });
    expect("children" in tree.items[0]).toBe(false);
  });
});
