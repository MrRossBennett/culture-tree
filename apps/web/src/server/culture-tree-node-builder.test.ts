import { describe, expect, it } from "vite-plus/test";

import { buildCultureTreeNode } from "./culture-tree-node-builder";

describe("buildCultureTreeNode", () => {
  it("builds freeform concept nodes without identity or snapshot", () => {
    const node = buildCultureTreeNode({
      kind: "concept",
      name: "Downtown cool",
      type: "article",
      connectionType: "thematic",
      reason: "Captures the scene's mood.",
      year: 1981,
    });

    expect(node).toMatchObject({
      name: "Downtown cool",
      type: "article",
      connectionType: "thematic",
      reason: "Captures the scene's mood.",
      year: 1981,
      source: "user",
      searchHint: { title: "Downtown cool" },
    });
    expect(node.id).toEqual(expect.any(String));
    expect(node.identity).toBeUndefined();
    expect(node.snapshot).toBeUndefined();
    expect("children" in node).toBe(false);
  });

  it("builds canonical-lite nodes from selected results", () => {
    const node = buildCultureTreeNode({
      kind: "search-result",
      connectionType: "influence",
      reason: "This is the direct reference point.",
      result: {
        identity: { source: "tmdb", externalId: "movie:550" },
        snapshot: {
          name: "Fight Club",
          type: "film",
          year: 1999,
          image: "https://image.tmdb.org/t/p/w185/poster.jpg",
        },
        searchHint: { title: "Fight Club" },
        meta: "1999",
        externalUrl: "https://www.themoviedb.org/movie/550",
      },
    });

    expect(node).toMatchObject({
      name: "Fight Club",
      type: "film",
      year: 1999,
      connectionType: "influence",
      reason: "This is the direct reference point.",
      source: "user",
      identity: { source: "tmdb", externalId: "movie:550" },
      snapshot: {
        name: "Fight Club",
        type: "film",
        year: 1999,
        image: "https://image.tmdb.org/t/p/w185/poster.jpg",
      },
      searchHint: { title: "Fight Club" },
    });
    expect(node.id).toEqual(expect.any(String));
    expect("children" in node).toBe(false);
  });

  it("allows empty reasons for quick adds", () => {
    const concept = buildCultureTreeNode({
      kind: "concept",
      name: "Downtown cool",
      type: "article",
      connectionType: "thematic",
      reason: "",
    });

    const selected = buildCultureTreeNode({
      kind: "search-result",
      connectionType: "thematic",
      reason: "",
      result: {
        identity: { source: "tmdb", externalId: "movie:550" },
        snapshot: {
          name: "Fight Club",
          type: "film",
          year: 1999,
          image: "https://image.tmdb.org/t/p/w185/poster.jpg",
        },
        searchHint: { title: "Fight Club" },
        meta: "1999",
        externalUrl: "https://www.themoviedb.org/movie/550",
      },
    });

    expect(concept.reason).toBe("");
    expect(selected.reason).toBe("");
  });
});
