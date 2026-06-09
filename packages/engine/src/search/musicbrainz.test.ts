import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { fetchMusicBrainzArtistAlbums } from "./musicbrainz";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

// A studio-album release-group (primary "Album", no secondary types) keyed by date so order is
// assertable. `secondaryTypes` makes it a non-studio release (live/compilation) that the filter drops.
function releaseGroup(date: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `rg-${date}`,
    title: `Album ${date}`,
    "first-release-date": date,
    "primary-type": "Album",
    "secondary-types": [],
    ...overrides,
  };
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  return new URL(typeof input === "string" ? input : input.url);
}

// Run the inter-page delay's timer immediately so paging tests don't wait the real ~1.1s/page.
function skipPageDelays(): void {
  vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
    if (typeof fn === "function") {
      fn();
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchMusicBrainzArtistAlbums", () => {
  it("returns studio albums oldest-first and drops live/compilation release-groups", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        "release-group-count": 3,
        "release-groups": [
          releaseGroup("2001"),
          releaseGroup("1999"),
          releaseGroup("2005", { "secondary-types": ["Live"] }), // dropped
        ],
      }),
    );

    const albums = await fetchMusicBrainzArtistAlbums("artist-mbid", 75);

    expect(albums?.map((a) => a.firstReleaseDate)).toEqual(["1999", "2001"]);
  });

  it("pages until the cap is reached when one page yields too few studio albums", async () => {
    skipPageDelays();
    // Page one is mostly compilations (only 2 studio), so the cap of 3 forces a second page.
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      const offset = url.searchParams.get("offset");
      if (offset === "0") {
        return jsonResponse({
          "release-group-count": 150,
          "release-groups": [
            releaseGroup("1990"),
            releaseGroup("1992"),
            releaseGroup("1994", { "secondary-types": ["Compilation"] }),
          ],
        });
      }
      return jsonResponse({
        "release-group-count": 150,
        "release-groups": [releaseGroup("1996"), releaseGroup("1998")],
      });
    });

    const albums = await fetchMusicBrainzArtistAlbums("artist-mbid", 3);

    // Two pages fetched; capped at 3, oldest-first.
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(albums?.map((a) => a.firstReleaseDate)).toEqual(["1990", "1992", "1996"]);
  });

  it("stops paging once the discography is exhausted (offset reaches the total)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        "release-group-count": 2,
        "release-groups": [releaseGroup("2010"), releaseGroup("2012")],
      }),
    );

    const albums = await fetchMusicBrainzArtistAlbums("artist-mbid", 75);

    expect(fetchMock.mock.calls.length).toBe(1); // total (2) < page size, no second page
    expect(albums).toHaveLength(2);
  });

  it("returns a partial discography when a later page fails, not null", async () => {
    skipPageDelays();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.searchParams.get("offset") === "0") {
        return jsonResponse({
          "release-group-count": 150,
          "release-groups": [releaseGroup("2000"), releaseGroup("2002")],
        });
      }
      return new Response("nope", { status: 503 });
    });

    const albums = await fetchMusicBrainzArtistAlbums("artist-mbid", 75);

    expect(fetchMock.mock.calls.length).toBe(2);
    expect(albums?.map((a) => a.firstReleaseDate)).toEqual(["2000", "2002"]);
  });

  it("returns null when the first page fails (couldn't load, distinct from no albums)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));

    expect(await fetchMusicBrainzArtistAlbums("artist-mbid", 75)).toBeNull();
  });
});
