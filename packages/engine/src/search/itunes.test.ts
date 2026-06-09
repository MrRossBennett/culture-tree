import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { fetchItunesArtistAlbumCovers, fetchItunesCover, normalizeAlbumTitle } from "./itunes";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function albumResult(overrides: Record<string, unknown> = {}) {
  return {
    wrapperType: "collection",
    artistName: "David Bowie",
    collectionName: "Low",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/.../100x100bb.jpg",
    ...overrides,
  };
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  return new URL(typeof input === "string" ? input : input.url);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeAlbumTitle", () => {
  it("strips diacritics, leading articles, punctuation, and edition parentheticals", () => {
    expect(normalizeAlbumTitle("Low")).toBe("low");
    expect(normalizeAlbumTitle("The Rise and Fall")).toBe("rise and fall");
    expect(normalizeAlbumTitle("Café Bleu")).toBe("cafe bleu");
    expect(normalizeAlbumTitle("Low (2017 Remaster)")).toBe("low");
    expect(normalizeAlbumTitle("Heroes [Deluxe Edition]")).toBe("heroes");
  });
});

describe("fetchItunesCover", () => {
  it("returns hi-res storefront art on a strict artist + title match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ results: [albumResult()] }));

    const cover = await fetchItunesCover("album", "David Bowie", "Low");

    // 100x100 upsized to the 600 gallery size.
    expect(cover).toBe("https://is1-ssl.mzstatic.com/image/.../600x600bb.jpg");
  });

  it("matches across an edition suffix when the artist agrees", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ results: [albumResult({ collectionName: "Low (2017 Remaster)" })] }),
    );

    const cover = await fetchItunesCover("album", "David Bowie", "Low");

    expect(cover).toBe("https://is1-ssl.mzstatic.com/image/.../600x600bb.jpg");
  });

  it("declines (falls back) when the artist does not match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ results: [albumResult({ artistName: "Some Tribute Band" })] }),
    );

    expect(await fetchItunesCover("album", "David Bowie", "Low")).toBeUndefined();
  });

  it("declines when no result title matches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ results: [albumResult({ collectionName: "Heroes" })] }),
    );

    expect(await fetchItunesCover("album", "David Bowie", "Low")).toBeUndefined();
  });

  it("matches a song on its track name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        results: [
          {
            wrapperType: "track",
            artistName: "David Bowie",
            trackName: "Heroes",
            artworkUrl100: "https://is1-ssl.mzstatic.com/image/.../100x100bb.jpg",
          },
        ],
      }),
    );

    const cover = await fetchItunesCover("song", "David Bowie", "Heroes");

    expect(cover).toBe("https://is1-ssl.mzstatic.com/image/.../600x600bb.jpg");
  });

  it("returns undefined when the lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 403 }));

    expect(await fetchItunesCover("album", "David Bowie", "Low")).toBeUndefined();
  });
});

describe("fetchItunesArtistAlbumCovers", () => {
  it("resolves the artist then maps every album cover by normalized title", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith("/search")) {
        return jsonResponse({ results: [{ artistId: 99, artistName: "David Bowie" }] });
      }
      return jsonResponse({
        results: [
          { artistId: 99, artistName: "David Bowie" }, // the artist wrapper Apple echoes back
          albumResult({ collectionName: "Low" }),
          albumResult({ collectionName: "“Heroes”" }),
        ],
      });
    });

    const covers = await fetchItunesArtistAlbumCovers("David Bowie");

    expect(covers.get(normalizeAlbumTitle("Low"))).toBe(
      "https://is1-ssl.mzstatic.com/image/.../600x600bb.jpg",
    );
    expect(covers.get(normalizeAlbumTitle("“Heroes”"))).toBeDefined();
    // One search + one lookup, never per-album.
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("returns an empty map when the resolved artist name does not match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ results: [{ artistId: 7, artistName: "Completely Different Act" }] }),
    );

    const covers = await fetchItunesArtistAlbumCovers("David Bowie");

    expect(covers.size).toBe(0);
  });
});
