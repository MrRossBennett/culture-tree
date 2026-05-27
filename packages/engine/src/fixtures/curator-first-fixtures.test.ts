import { CultureTreeSchema } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import grimyNewYork from "../../fixtures/grimy-new-york-70s-standard.json";
import okComputer from "../../fixtures/ok-computer-standard.json";

const generatedFixtures = [
  ["ok-computer-standard", okComputer],
  ["grimy-new-york-70s-standard", grimyNewYork],
] as const;

describe("committed Culture Tree fixtures", () => {
  it("use the curator-first flat Branch shape instead of legacy nested children", () => {
    for (const [fixtureName, raw] of generatedFixtures) {
      const tree = CultureTreeSchema.parse(raw);
      const sectionItemIds = new Set(
        tree.guideSections.flatMap((section) => section.items.map((item) => item.id)),
      );

      expect(tree.items.length, fixtureName).toBeGreaterThan(0);
      expect(tree.guideSections.length, fixtureName).toBeGreaterThan(0);
      expect(sectionItemIds.size, fixtureName).toBeGreaterThan(0);

      for (const item of tree.items) {
        expect("children" in item, `${fixtureName}:${item.id}`).toBe(false);
        expect(item.source, `${fixtureName}:${item.id}`).toBe("ai");
        expect(item.searchHint.title.trim(), `${fixtureName}:${item.id}`).not.toBe("");
      }
    }
  });

  it("keeps generated Guide Sections as optional AI scaffolding over shared Branches", () => {
    for (const [fixtureName, raw] of generatedFixtures) {
      const tree = CultureTreeSchema.parse(raw);
      const itemIds = new Set(tree.items.map((item) => item.id));

      for (const section of tree.guideSections) {
        for (const item of section.items) {
          expect(itemIds.has(item.id), `${fixtureName}:${section.id}:${item.id}`).toBe(true);
          expect(item.branchRole, `${fixtureName}:${section.id}:${item.id}`).toBeDefined();
        }
      }
    }
  });
});
