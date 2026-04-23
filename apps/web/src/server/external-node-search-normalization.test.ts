import {
  buildTmdbSearchQueries,
  diversifySearchResults,
  dedupeExternalSearchResults,
  normalizeGoogleBooksSearchResult,
  normalizeTmdbSearchResult,
  normalizeWikipediaSearchResult,
} from "@repo/engine";
import { describe, expect, it } from "vite-plus/test";

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

  it("filters Wikipedia disambiguation pages", () => {
    const result = normalizeWikipediaSearchResult({
      search: {
        title: "Queen",
      },
      summary: {
        description: "Topics referred to by the same term",
        extract: "Queen may refer to multiple topics in music, monarchy, and popular culture.",
      },
      query: "queen",
      rank: 0,
    });

    expect(result).toBeNull();
  });

  it("expands short TMDB queries with a leading-article variant", () => {
    expect(buildTmdbSearchQueries("queen")).toEqual(["queen", "the queen"]);
    expect(buildTmdbSearchQueries("the queen")).toEqual(["the queen"]);
    expect(buildTmdbSearchQueries("queen latifah")).toEqual(["queen latifah", "the queen latifah"]);
  });

  it("boosts disambiguated artist results above exact-match films", () => {
    const film = normalizeTmdbSearchResult(
      {
        id: 247645,
        title: "Queen",
        release_date: "2014-01-01",
        poster_path: "/queen-film.jpg",
      },
      "movie",
      "queen",
      0,
    );

    const artist = normalizeWikipediaSearchResult({
      search: {
        title: "Queen (band)",
      },
      summary: {
        description: "British rock band",
        extract: "Queen are a British rock band formed in London in 1970.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Queen_(band)" } },
      },
      query: "queen",
      rank: 0,
    });

    expect(film?.score).toBeDefined();
    expect(artist?.score).toBeDefined();
    expect((artist?.score ?? 0) > (film?.score ?? 0)).toBe(true);
  });

  it("keeps strong partial-title films competitive for broad queries", () => {
    const exactFilm = normalizeTmdbSearchResult(
      {
        id: 247645,
        title: "Queen",
        release_date: "2014-01-01",
        vote_count: 5,
      },
      "movie",
      "queen",
      0,
    );

    const partialFilm = normalizeTmdbSearchResult(
      {
        id: 8273,
        title: "The Queen",
        release_date: "2006-09-15",
        vote_count: 950,
      },
      "movie",
      "queen",
      10,
    );

    expect(exactFilm?.score).toBeDefined();
    expect(partialFilm?.score).toBeDefined();
    expect((partialFilm?.score ?? 0) > (exactFilm?.score ?? 0)).toBe(true);
  });

  it("diversifies strong title matches across core categories", () => {
    const diversified = diversifySearchResults(
      [
        {
          identity: { source: "wikipedia", externalId: "Queen_(band)" },
          snapshot: { name: "Queen (band)", type: "artist" },
          searchHint: { title: "Queen", wikiSlug: "Queen_(band)" },
          meta: "British rock band",
          externalUrl: "https://en.wikipedia.org/wiki/Queen_(band)",
        },
        {
          identity: { source: "tmdb", externalId: "movie:1165" },
          snapshot: { name: "The Queen", type: "film", year: 2006 },
          searchHint: { title: "The Queen" },
          meta: "2006",
          externalUrl: "https://www.themoviedb.org/movie/1165",
        },
        {
          identity: { source: "tmdb", externalId: "movie:247645" },
          snapshot: { name: "Queen", type: "film", year: 2014 },
          searchHint: { title: "Queen" },
          meta: "2014",
          externalUrl: "https://www.themoviedb.org/movie/247645",
        },
        {
          identity: { source: "wikipedia", externalId: "Queen_(Queen_album)" },
          snapshot: { name: "Queen (Queen album)", type: "album", year: 1973 },
          searchHint: { title: "Queen", wikiSlug: "Queen_(Queen_album)" },
          meta: "1973 debut studio album by Queen",
          externalUrl: "https://en.wikipedia.org/wiki/Queen_(Queen_album)",
        },
      ],
      "queen",
    );

    expect(diversified.slice(0, 3).map((result) => result.snapshot.type)).toEqual([
      "artist",
      "album",
      "film",
    ]);
    expect(diversified[2]).toMatchObject({
      identity: { source: "tmdb", externalId: "movie:1165" },
      snapshot: { name: "The Queen", type: "film", year: 2006 },
    });
  });

  it("prefers TMDB over Wikipedia for duplicate film results", () => {
    const deduped = dedupeExternalSearchResults([
      {
        identity: { source: "tmdb", externalId: "movie:10537" },
        snapshot: {
          name: "The Doors",
          type: "film",
          year: 1991,
          image: "https://image.tmdb.org/t/p/w185/poster.jpg",
        },
        searchHint: { title: "The Doors" },
        meta: "1991",
        externalUrl: "https://www.themoviedb.org/movie/10537",
      },
      {
        identity: { source: "wikipedia", externalId: "The_Doors_(film)" },
        snapshot: {
          name: "The Doors (film)",
          type: "article",
          year: 1991,
        },
        searchHint: { title: "The Doors", wikiSlug: "The_Doors_(film)" },
        meta: "1991 biographical film directed by Oliver Stone",
        externalUrl: "https://en.wikipedia.org/wiki/The_Doors_(film)",
      },
      {
        identity: { source: "wikipedia", externalId: "The_Doors" },
        snapshot: {
          name: "The Doors",
          type: "artist",
        },
        searchHint: { title: "The Doors", wikiSlug: "The_Doors" },
        meta: "American rock band",
        externalUrl: "https://en.wikipedia.org/wiki/The_Doors",
      },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identity: { source: "tmdb", externalId: "movie:10537" },
          snapshot: expect.objectContaining({ type: "film", name: "The Doors", year: 1991 }),
        }),
        expect.objectContaining({
          identity: { source: "wikipedia", externalId: "The_Doors" },
          snapshot: expect.objectContaining({ type: "artist", name: "The Doors" }),
        }),
      ]),
    );
  });
});
