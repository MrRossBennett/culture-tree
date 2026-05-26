import { describe, expect, it } from "vite-plus/test";

import { CultureTreeSchema, acceptCultureTreeGenerationOutput } from "./tree";

describe("acceptCultureTreeGenerationOutput", () => {
  it("accepts canonical Culture Tree output", () => {
    const tree = acceptCultureTreeGenerationOutput({
      seedLabel: "Ghost Dog",
      output: {
        seed: "Ghost Dog",
        seedType: "root",
        items: [
          {
            id: "item_1",
            name: "Liquid Swords",
            type: "album",
            reason: "Turns noir dread into cold-blooded mythology.",
            connectionType: "spiritual-kin",
            searchHint: { title: "Liquid Swords by GZA" },
          },
        ],
      },
    });

    expect(tree.items[0]?.searchHint).toEqual({ title: "Liquid Swords", creator: "GZA" });
  });

  it("accepts Start Here Guide Sections and derives flat items", () => {
    const tree = acceptCultureTreeGenerationOutput({
      seedLabel: "Ghost Dog",
      output: {
        seed: "Ghost Dog",
        seedType: "root",
        guideSections: [
          {
            id: "start-here",
            title: "Start Here",
            description: "The strongest next moves from the seed.",
            items: [
              {
                id: "item_1",
                name: "Le Samourai",
                type: "film",
                reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
                connectionType: "influence",
                branchRole: "essential-next",
                searchHint: { title: "Le Samourai" },
              },
            ],
          },
        ],
      },
    });

    expect(tree.guideSections[0]).toMatchObject({
      id: "start-here",
      title: "Start Here",
      items: [{ id: "item_1", branchRole: "essential-next" }],
    });
    expect(tree.items.map((item) => item.id)).toEqual(["item_1"]);
  });

  it("rejects unknown Guide Sections and Branch Roles", () => {
    expect(() =>
      CultureTreeSchema.parse({
        seed: "Ghost Dog",
        seedType: "root",
        guideSections: [
          {
            id: "vibes",
            title: "Vibes",
            items: [
              {
                id: "item_1",
                name: "Le Samourai",
                type: "film",
                reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
                connectionType: "influence",
                branchRole: "cool-one",
                searchHint: { title: "Le Samourai" },
                source: "ai",
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts legacy nested output as flat Branches", () => {
    const tree = acceptCultureTreeGenerationOutput({
      seedLabel: "Ghost Dog",
      output: {
        name: "Ghost Dog",
        type: "root",
        children: [
          {
            name: "Le Samourai",
            type: "film",
            reason: "Shares the ritualized solitude of the professional outsider.",
            connectionType: "influence",
            searchHint: { title: "Le Samourai" },
            children: [
              {
                name: "Branded to Kill",
                type: "film",
                reason: "Pushes hitman cool into fever-dream abstraction.",
                connectionType: "spiritual-kin",
                searchHint: { title: "Branded to Kill" },
              },
            ],
          },
        ],
      },
    });

    expect(tree).toMatchObject({
      seed: "Ghost Dog",
      seedType: "root",
      items: [
        { id: "item_001", name: "Le Samourai" },
        { id: "item_002", name: "Branded to Kill" },
      ],
    });
  });
});
