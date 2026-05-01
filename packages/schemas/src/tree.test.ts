import { describe, expect, it } from "vite-plus/test";

import { acceptCultureTreeGenerationOutput } from "./tree";

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
