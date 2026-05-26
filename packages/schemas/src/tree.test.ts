import { describe, expect, it } from "vite-plus/test";

import {
  CORE_RECOMMENDATION_GUIDE_SECTION_IDS,
  CultureTreeSchema,
  GUIDE_SECTION_DISPLAY_ORDER,
  acceptCultureTreeGenerationOutput,
} from "./tree";

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
    expect(tree.guideSections.map((section) => section.id)).toEqual(
      CORE_RECOMMENDATION_GUIDE_SECTION_IDS,
    );
    expect(tree.items.map((item) => item.id)).toEqual(["item_1", "item_2", "item_3", "item_4"]);
  });

  it("rejects unknown Guide Sections, missing core sections, invalid Branch Roles, and duplicates", () => {
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

    expect(() =>
      CultureTreeSchema.parse({
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
                branchRole: "sideways-path",
                searchHint: { title: "Le Samourai" },
                source: "ai",
              },
            ],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      CultureTreeSchema.parse({
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
                id: "item_1",
                name: "Le Samourai",
                type: "film",
                reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
                connectionType: "influence",
                branchRole: "similar-appetite",
                searchHint: { title: "Le Samourai" },
                source: "ai",
              },
            ],
          },
          {
            id: "go-sideways",
            title: "Go Sideways",
            items: [
              {
                id: "item_2",
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
                id: "item_3",
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
      }),
    ).toThrow();
  });

  it("normalizes generated Guide Sections into fixed order and removes duplicate Branches", () => {
    const tree = acceptCultureTreeGenerationOutput({
      seedLabel: "Ghost Dog",
      output: {
        seed: "Ghost Dog",
        seedType: "root",
        guideSections: [
          {
            id: "go-deeper",
            title: "Go Deeper",
            items: [
              {
                id: "item_3",
                name: "A Colt Is My Passport",
                type: "film",
                reason: "A leaner, stranger route into the same assassin fatalism.",
                connectionType: "contemporary",
                branchRole: "deep-cut",
                searchHint: { title: "A Colt Is My Passport" },
              },
            ],
          },
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
              },
            ],
          },
          {
            id: "more-like-this",
            title: "More Like This",
            items: [
              {
                id: "item_1",
                name: "Le Samourai",
                type: "film",
                reason: "A near-perfect next stop for ritualized solitude and cool restraint.",
                connectionType: "influence",
                branchRole: "similar-appetite",
                searchHint: { title: "Le Samourai" },
              },
              {
                id: "item_2",
                name: "Branded to Kill",
                type: "film",
                reason: "A stranger variation on hitman cool and dream logic.",
                connectionType: "spiritual-kin",
                branchRole: "similar-appetite",
                searchHint: { title: "Branded to Kill" },
              },
            ],
          },
          {
            id: "go-sideways",
            title: "Go Sideways",
            items: [
              {
                id: "item_4",
                name: "Liquid Swords",
                type: "album",
                reason: "Moves the same lone-warrior code into icy street mythology.",
                connectionType: "spiritual-kin",
                branchRole: "sideways-path",
                searchHint: { title: "Liquid Swords", creator: "GZA" },
              },
            ],
          },
        ],
      },
    });

    expect(tree.guideSections.map((section) => section.id)).toEqual(
      CORE_RECOMMENDATION_GUIDE_SECTION_IDS,
    );
    expect(tree.items.map((item) => item.id)).toEqual(["item_1", "item_2", "item_4", "item_3"]);
  });

  it("accepts optional Join The Dots after More Like This when documented context exists", () => {
    const tree = acceptCultureTreeGenerationOutput({
      seedLabel: "OK Computer",
      output: {
        seed: "OK Computer",
        seedType: "root",
        guideSections: [
          {
            id: "start-here",
            title: "Start Here",
            items: [
              {
                id: "item_1",
                name: "Talk Talk — Spirit of Eden",
                type: "album",
                reason: "A direct first step into post-rock atmosphere and haunted restraint.",
                connectionType: "influence",
                branchRole: "essential-next",
                searchHint: { title: "Spirit of Eden", creator: "Talk Talk" },
              },
            ],
          },
          {
            id: "more-like-this",
            title: "More Like This",
            items: [
              {
                id: "item_2",
                name: "Koyaanisqatsi",
                type: "film",
                reason:
                  "Another widescreen machine-age panic with beauty and dread fused together.",
                connectionType: "thematic",
                branchRole: "similar-appetite",
                searchHint: { title: "Koyaanisqatsi" },
              },
            ],
          },
          {
            id: "join-the-dots",
            title: "Join The Dots",
            items: [
              {
                id: "item_3",
                name: "Chris Marker — La Jetee",
                type: "film",
                reason:
                  "Radiohead cited Marker as an influence on the Amnesiac artwork, making this documented context rather than loose mood matching.",
                connectionType: "documented-by",
                branchRole: "documented-context",
                searchHint: { title: "La Jetee", creator: "Chris Marker" },
              },
            ],
          },
          {
            id: "go-sideways",
            title: "Go Sideways",
            items: [
              {
                id: "item_4",
                name: "Roadside Picnic",
                type: "book",
                reason: "A sideways path into unknowable technology and radioactive aftermath.",
                connectionType: "spiritual-kin",
                branchRole: "sideways-path",
                searchHint: { title: "Roadside Picnic", creator: "Arkady Strugatsky" },
              },
            ],
          },
          {
            id: "go-deeper",
            title: "Go Deeper",
            items: [
              {
                id: "item_5",
                name: "AMM — AMMMusic",
                type: "album",
                reason: "A deeper route into silence, texture, and anti-song composition.",
                connectionType: "influence",
                branchRole: "deep-cut",
                searchHint: { title: "AMMMusic", creator: "AMM" },
              },
            ],
          },
        ],
      },
    });

    expect(tree.guideSections.map((section) => section.id)).toEqual(GUIDE_SECTION_DISPLAY_ORDER);
    expect(tree.guideSections[2]).toMatchObject({
      id: "join-the-dots",
      items: [{ branchRole: "documented-context", connectionType: "documented-by" }],
    });
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
