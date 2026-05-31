import {
  blendByCategoryQuota,
  buildTmdbSearchQueries,
  dedupeExternalSearchResults,
  filterWikipediaFallbackResults,
  isConfidentCreatorMatch,
  isConfidentMusicBrainzArtist,
  isStrongWorkTitleMatch,
  normalizeGoogleBooksSearchResult,
  normalizeMusicBrainzArtist,
  normalizeMusicBrainzReleaseGroup,
  normalizeTmdbCreditResult,
  normalizeTmdbPersonResult,
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

  it("maps a MusicBrainz artist into an expandable artist subject", () => {
    const result = normalizeMusicBrainzArtist(
      {
        id: "mb-art-1",
        name: "Elton John",
        type: "Person",
        disambiguation: "English musician",
        score: 100,
      },
      "elton john",
      0,
    );

    expect(result).toMatchObject({
      kind: "expandable-subject",
      identity: { source: "musicbrainz", externalId: "artist:mb-art-1" },
      snapshot: { name: "Elton John", type: "artist" },
      searchHint: { title: "Elton John" },
      externalUrl: "https://musicbrainz.org/artist/mb-art-1",
    });
  });

  it("scores a resolved artist's album as a top-tier work, with a Cover Art Archive image", () => {
    // Discography expansion: query is empty, resolvedWork carries the score, and the album
    // identity is the *bare* release-group MBID (the convention the entity resolver expects).
    const result = normalizeMusicBrainzReleaseGroup(
      {
        id: "mb-rg-1",
        title: "Goodbye Yellow Brick Road",
        firstReleaseDate: "1973-10-05",
        primaryType: "Album",
        secondaryTypes: [],
        artistName: "Elton John",
      },
      "",
      0,
      { resolvedWork: true },
    );

    expect(result).toMatchObject({
      kind: "addable-work",
      identity: { source: "musicbrainz", externalId: "mb-rg-1" },
      snapshot: { name: "Goodbye Yellow Brick Road", type: "album", year: 1973 },
      searchHint: { title: "Goodbye Yellow Brick Road", creator: "Elton John" },
      meta: "Elton John • 1973",
    });
    expect(result?.snapshot.image).toContain("coverartarchive.org/release-group/mb-rg-1");
    // Resolved work: scored above the ~124 a literal title match would earn.
    expect(result?.score ?? 0).toBeGreaterThan(124);
  });

  it("maps a MusicBrainz release-group title match into an album work", () => {
    const result = normalizeMusicBrainzReleaseGroup(
      {
        id: "mb-rg-2",
        title: "Rubber Soul",
        firstReleaseDate: "1965-12-03",
        primaryType: "Album",
        secondaryTypes: [],
        artistName: "The Beatles",
        score: 100,
      },
      "rubber soul",
      0,
    );

    expect(result).toMatchObject({
      kind: "addable-work",
      identity: { source: "musicbrainz", externalId: "mb-rg-2" },
      snapshot: { name: "Rubber Soul", type: "album", year: 1965 },
      searchHint: { title: "Rubber Soul", creator: "The Beatles" },
      meta: "The Beatles • 1965",
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

  it("uses Wikipedia as a book search fallback for novel pages", () => {
    const result = normalizeWikipediaSearchResult({
      search: {
        title: "The Da Vinci Code",
        pageid: 123,
      },
      summary: {
        description: "2003 mystery thriller novel by Dan Brown",
        extract: "The Da Vinci Code is a 2003 mystery thriller novel by American author Dan Brown.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/The_Da_Vinci_Code" } },
      },
      query: "The Da Vinci Code",
      rank: 0,
    });

    expect(result).toMatchObject({
      identity: { source: "wikipedia", externalId: "The_Da_Vinci_Code" },
      snapshot: {
        name: "The Da Vinci Code",
        type: "book",
      },
      searchHint: {
        title: "The Da Vinci Code",
        creator: "Dan Brown",
        wikiSlug: "The_Da_Vinci_Code",
      },
    });
  });

  it("does not misclassify Wikipedia film pages that mention their source novel", () => {
    const result = normalizeWikipediaSearchResult({
      search: {
        title: "The Da Vinci Code (film)",
        pageid: 456,
      },
      summary: {
        description: "2006 mystery thriller film by Ron Howard",
        extract:
          "The Da Vinci Code is a 2006 mystery thriller film based on the 2003 novel by Dan Brown.",
        content_urls: {
          desktop: { page: "https://en.wikipedia.org/wiki/The_Da_Vinci_Code_(film)" },
        },
      },
      query: "The Da Vinci Code",
      rank: 0,
    });

    expect(result).toMatchObject({
      identity: { source: "wikipedia", externalId: "The_Da_Vinci_Code_(film)" },
      snapshot: {
        name: "The Da Vinci Code (film)",
        type: "film",
        year: 2006,
      },
    });
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
        popularity: 5,
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
        popularity: 950,
      },
      "movie",
      "queen",
      10,
    );

    expect(exactFilm?.score).toBeDefined();
    expect(partialFilm?.score).toBeDefined();
    expect((partialFilm?.score ?? 0) > (exactFilm?.score ?? 0)).toBe(true);
  });

  const make = (
    source: "tmdb" | "musicbrainz",
    externalId: string,
    name: string,
    type: "artist" | "album" | "film",
    score: number,
    year?: number,
  ) => ({
    kind: "addable-work" as const,
    identity: { source, externalId },
    snapshot: { name, type, year },
    searchHint: { title: name },
    score,
  });

  const blendInput = () => [
    make("musicbrainz", "artist:1", "Queen", "artist", 150),
    make("tmdb", "movie:1", "Queen", "film", 140, 2014),
    make("tmdb", "movie:2", "Queen Bee", "film", 120, 2020),
    make("tmdb", "movie:3", "Queens", "film", 118, 2019),
    make("tmdb", "movie:4", "Queen of the Damned", "film", 116, 2002),
    make("tmdb", "movie:5", "The African Queen", "film", 114, 1951),
    make("musicbrainz", "rg:1", "Greatest Hits", "album", 100, 1981),
    make("musicbrainz", "rg:2", "Jazz", "album", 130, 1978),
  ];

  it("groups results by category in display order, sorted by score within each group", () => {
    const blended = blendByCategoryQuota(blendInput(), 100, { enforceQuotas: false });

    // Category sections in order: artist, then album, then film. No interleaving.
    expect(blended.map((result) => result.snapshot.type)).toEqual([
      "artist",
      "album",
      "album",
      "film",
      "film",
      "film",
      "film",
      "film",
    ]);
    // Within the album group, higher score comes first.
    expect(
      blended.filter((r) => r.snapshot.type === "album").map((r) => r.identity.externalId),
    ).toEqual(["album:2", "album:1"]);
  });

  it("caps each category at its quota when quotas are enforced", () => {
    const blended = blendByCategoryQuota(blendInput(), 100, { enforceQuotas: true });

    // Films capped at their quota of 5; the input's five candidates all fit.
    expect(blended.filter((result) => result.snapshot.type === "film")).toHaveLength(5);
    // Albums (quota 12) and the single artist are kept in full.
    expect(blended.filter((result) => result.snapshot.type === "album")).toHaveLength(2);
    expect(blended.filter((result) => result.snapshot.type === "artist")).toHaveLength(1);
  });

  it("merges duplicate artists, keeping Wikipedia text and the other source's image", () => {
    const merged = dedupeExternalSearchResults([
      {
        kind: "addable-work" as const,
        identity: { source: "wikipedia", externalId: "Queen_(band)" },
        snapshot: { name: "Queen (band)", type: "artist" },
        searchHint: { title: "Queen", wikiSlug: "Queen_(band)" },
        meta: "British rock band",
        externalUrl: "https://en.wikipedia.org/wiki/Queen_(band)",
      },
      {
        kind: "addable-work" as const,
        identity: { source: "musicbrainz", externalId: "artist:1" },
        snapshot: {
          name: "Queen",
          type: "artist",
          image: "https://commons.wikimedia.org/queen.jpg",
        },
        searchHint: { title: "Queen" },
        meta: "rock",
        externalUrl: "https://musicbrainz.org/artist/1",
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      identity: { source: "wikipedia", externalId: "Queen_(band)" },
      snapshot: {
        name: "Queen (band)",
        type: "artist",
        image: "https://commons.wikimedia.org/queen.jpg",
      },
      meta: "British rock band",
    });
  });

  it("prefers TMDB over Wikipedia for duplicate film results", () => {
    const deduped = dedupeExternalSearchResults([
      {
        kind: "addable-work" as const,
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
        kind: "addable-work" as const,
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
        kind: "addable-work" as const,
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

  it("maps a TMDB person match into a person result", () => {
    const result = normalizeTmdbPersonResult(
      {
        id: 1032,
        name: "Martin Scorsese",
        profile_path: "/profile.jpg",
        popularity: 12,
        known_for_department: "Directing",
      },
      "scorsese",
      0,
    );

    expect(result).toMatchObject({
      identity: { source: "tmdb", externalId: "person:1032" },
      snapshot: {
        name: "Martin Scorsese",
        type: "person",
        image: "https://image.tmdb.org/t/p/w185/profile.jpg",
      },
      meta: "Director",
      externalUrl: "https://www.themoviedb.org/person/1032",
    });
    expect(result?.score).toBeGreaterThan(0);
  });

  it("scores a resolved creator's credit as a top-tier work, above title-match noise", () => {
    const film = normalizeTmdbCreditResult(
      {
        id: 769,
        media_type: "movie",
        title: "GoodFellas",
        release_date: "1990-09-12",
        poster_path: "/goodfellas.jpg",
        popularity: 30,
        department: "Directing",
        job: "Director",
      },
      "Martin Scorsese",
      0,
    );

    expect(film).toMatchObject({
      identity: { source: "tmdb", externalId: "movie:769" },
      snapshot: { name: "GoodFellas", type: "film", year: 1990 },
      searchHint: { title: "GoodFellas", creator: "Martin Scorsese" },
    });
    // A song literally named "Scorsese" scores ~124 by exact title match; the
    // director's actual film must outrank it.
    expect(film?.score ?? 0).toBeGreaterThan(124);
  });

  it("ignores credits that are neither movie nor tv", () => {
    const result = normalizeTmdbCreditResult(
      { id: 1, media_type: "person", name: "Someone" },
      "Someone",
      0,
    );

    expect(result).toBeNull();
  });

  it("treats a creator match as confident only when it is exact or a popular distinctive token", () => {
    // Exact name match — confident regardless of popularity.
    expect(isConfidentCreatorMatch("Radiohead", "radiohead", 0)).toBe(true);
    // Surname-only query backed by a popular, dominant person — confident.
    expect(isConfidentCreatorMatch("Martin Scorsese", "scorsese", 20)).toBe(true);
    // Same surname but an obscure namesake — not confident, so we don't expand.
    expect(isConfidentCreatorMatch("Domenica Cameron-Scorsese", "scorsese", 1)).toBe(false);
    // A multi-word non-exact query is too ambiguous to treat as a creator name.
    expect(isConfidentCreatorMatch("Martin Scorsese", "martin s", 50)).toBe(false);
  });

  const wikiResult = (name: string, type: "person" | "artwork" | "book" | "album") => ({
    identity: { source: "wikipedia" as const, externalId: name.replaceAll(" ", "_") },
    snapshot: { name, type },
    searchHint: { title: name },
    score: 90,
  });

  it("keeps only Wikipedia's additive types (artwork) when primary sources found results", () => {
    const wikipediaResults = [
      wikiResult("Toni Morrison", "person"),
      wikiResult("Mona Lisa", "artwork"),
      wikiResult("Beloved", "book"),
      wikiResult("Jazz", "album"),
    ] as never[];

    const filtered = filterWikipediaFallbackResults(wikipediaResults, {
      hasUsablePrimaryResult: true,
    });

    // Creators aren't addable, so Wikipedia people are not kept even as a fallback;
    // only artworks survive (the primary sources structurally can't produce them).
    expect(filtered.map((r) => r.snapshot.type).sort()).toEqual(["artwork"]);
  });

  it("uses Wikipedia in full as the backup when primary sources found nothing", () => {
    const wikipediaResults = [
      wikiResult("Beloved", "book"),
      wikiResult("Mona Lisa", "artwork"),
    ] as never[];

    const filtered = filterWikipediaFallbackResults(wikipediaResults, {
      hasUsablePrimaryResult: false,
    });

    expect(filtered).toHaveLength(2);
  });

  it("dedupes a Wikipedia person against the TMDB person, keeping TMDB", () => {
    const deduped = dedupeExternalSearchResults([
      {
        kind: "expandable-subject" as const,
        identity: { source: "tmdb", externalId: "person:1032" },
        snapshot: { name: "Martin Scorsese", type: "person" },
        searchHint: { title: "Martin Scorsese" },
        score: 110,
      },
      {
        kind: "expandable-subject" as const,
        identity: { source: "wikipedia", externalId: "Martin_Scorsese" },
        snapshot: { name: "Martin Scorsese", type: "person" },
        searchHint: { title: "Martin Scorsese" },
        score: 95,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].identity).toMatchObject({ source: "tmdb", externalId: "person:1032" });
  });

  it("classifies a Wikipedia film director as a person, not a film", () => {
    const result = normalizeWikipediaSearchResult({
      search: { title: "Martin Scorsese", pageid: 1032 },
      summary: {
        description: "American film director, producer and screenwriter (born 1942)",
        extract: "Martin Charles Scorsese is an American film director.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Martin_Scorsese" } },
      },
      query: "scorsese",
      rank: 0,
    });

    expect(result).toMatchObject({
      identity: { source: "wikipedia", externalId: "Martin_Scorsese" },
      snapshot: { name: "Martin Scorsese", type: "person" },
    });
  });
});

describe("work-branch strong title gate", () => {
  it("accepts an exact (and article-insensitive) title match", () => {
    expect(isStrongWorkTitleMatch("blue", "Blue")).toBe(true);
    // Article-insensitive: the leading article is stripped from the title side.
    expect(isStrongWorkTitleMatch("warriors", "The Warriors")).toBe(true);
    expect(isStrongWorkTitleMatch("blue", "Blue (Remastered)")).toBe(true);
  });

  it("rejects single-word queries that only appear inside a longer title", () => {
    // The noise the old flat search produced: "Blue" dragging in everything blue-ish.
    expect(isStrongWorkTitleMatch("blue", "Blue Valentine")).toBe(false);
    expect(isStrongWorkTitleMatch("heroes", "Guardians: Heroes Reborn")).toBe(false);
    expect(isStrongWorkTitleMatch("heat", "Heatwave")).toBe(false);
  });

  it("lets specific multi-word queries match by containment", () => {
    expect(
      isStrongWorkTitleMatch(
        "lord of the rings",
        "The Lord of the Rings: The Fellowship of the Ring",
      ),
    ).toBe(true);
    expect(isStrongWorkTitleMatch("in rainbows", "In Rainbows")).toBe(true);
  });
});

describe("confident MusicBrainz artist gate", () => {
  it("treats an exact / article-insensitive artist name as confident", () => {
    expect(isConfidentMusicBrainzArtist("Radiohead", "radiohead", 100, 0)).toBe(true);
    expect(isConfidentMusicBrainzArtist("The Beatles", "beatles", 100, 0)).toBe(true);
  });

  it("accepts an exact name match regardless of rank/score (same rule as 'Radiohead')", () => {
    expect(isConfidentMusicBrainzArtist("Blue", "blue", 50, 0)).toBe(true);
  });

  it("treats the top relevance hit on a distinctive token as confident", () => {
    expect(isConfidentMusicBrainzArtist("David Bowie", "bowie", 100, 0)).toBe(true);
  });

  it("rejects a non-top or low-relevance single-token match (avoids the wrong creator)", () => {
    // Not the top result → not confident, so "blue" doesn't route into a deep-list band.
    expect(isConfidentMusicBrainzArtist("Bobby Blue", "blue", 100, 3)).toBe(false);
    // Top result but weak relevance → not confident.
    expect(isConfidentMusicBrainzArtist("David Bowie", "bowie", 70, 0)).toBe(false);
  });

  it("rejects multi-word non-exact queries as too ambiguous to be a creator name", () => {
    expect(isConfidentMusicBrainzArtist("David Bowie", "david bowie songs", 100, 0)).toBe(false);
  });
});
