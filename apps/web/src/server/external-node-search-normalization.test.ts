import {
  normalizeGoogleBooksSearchResult,
  normalizeTmdbSearchResult,
  normalizeWikipediaSearchResult,
} from "@repo/engine";
import { describe, expect, it } from "vitest";

describe("search result normalization", () => {
  it("encodes TMDB media kind into canonical-lite identity", () => {
    const result = normalizeTmdbSearchResult(
      {
        id: 550,
        title: "Fight Club",
        release_date: "1999-10-15",
        poster_path: "/poster.jpg",
      },
      "movie",
      "fight club",
      0,
    );

    expect(result).toMatchObject({
      identity: { source: "tmdb", externalId: "movie:550" },
      snapshot: {
        name: "Fight Club",
        type: "film",
        year: 1999,
        image: "https://image.tmdb.org/t/p/w185/poster.jpg",
      },
      searchHint: { title: "Fight Club" },
    });
  });

  it("maps Google Books metadata into a node-ready result", () => {
    const result = normalizeGoogleBooksSearchResult(
      {
        id: "vol-123",
        volumeInfo: {
          title: "Beloved",
          authors: ["Toni Morrison"],
          publishedDate: "1987-09-16",
          imageLinks: { thumbnail: "http://books.example/cover.jpg" },
        },
      },
      "beloved",
      0,
    );

    expect(result).toMatchObject({
      identity: { source: "google-books", externalId: "vol-123" },
      snapshot: {
        name: "Beloved",
        type: "book",
        year: 1987,
        image: "https://books.example/cover.jpg",
      },
      searchHint: {
        title: "Beloved",
        creator: "Toni Morrison",
      },
      meta: "Toni Morrison • 1987",
    });
  });

  it("keeps only supported Wikipedia result types", () => {
    const artist = normalizeWikipediaSearchResult({
      search: {
        title: "Suicide",
        pageid: 123,
      },
      summary: {
        description: "American punk duo",
        extract: "Suicide were an American punk duo formed in New York City.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Suicide_(band)" } },
      },
      query: "suicide",
      rank: 0,
    });

    expect(artist).toMatchObject({
      identity: { source: "wikipedia", externalId: "Suicide" },
      snapshot: {
        name: "Suicide",
        type: "artist",
      },
      searchHint: {
        title: "Suicide",
        wikiSlug: "Suicide",
      },
    });

    const unsupported = normalizeWikipediaSearchResult({
      search: {
        title: "Lower East Side",
      },
      summary: {
        description: "Neighborhood in Manhattan, New York City",
      },
      query: "lower east side",
      rank: 0,
    });

    expect(unsupported).toBeNull();
  });
});
