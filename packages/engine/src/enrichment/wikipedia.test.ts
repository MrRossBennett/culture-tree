import type { TreeItem } from "@repo/schemas";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { fetchWikipediaEventEnrichment, fetchWikipediaPlaceEnrichment } from "./wikipedia";

function makeItem(overrides: Partial<TreeItem>): TreeItem {
  return {
    id: "item-1",
    name: "The Haçienda",
    type: "place",
    reason: "A scene-defining club.",
    connectionType: "frequented",
    searchHint: { title: "The Haçienda" },
    source: "ai",
    ...overrides,
  };
}

function wikiSummary(title: string) {
  return {
    content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title}` } },
    extract: `${title} summary text.`,
    description: "notable topic",
    thumbnail: { source: `https://upload.wikimedia.org/${title}-thumb.jpg` },
    originalimage: { source: `https://upload.wikimedia.org/${title}.jpg` },
    coordinates: { lat: 53.474, lon: -2.246 },
  };
}

function urlFromFetchInput(input: Parameters<typeof fetch>[0]): URL {
  if (input instanceof URL) {
    return input;
  }
  if (input instanceof Request) {
    return new URL(input.url);
  }
  return new URL(input);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Wikipedia enrichment", () => {
  it("maps Wikipedia summary images and coordinates for place nodes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(wikiSummary("The_Haçienda")), { status: 200 }),
    );

    const media = await fetchWikipediaPlaceEnrichment(
      makeItem({ searchHint: { title: "The Haçienda", wikiSlug: "The_Haçienda" } }),
    );

    expect(media).toMatchObject({
      coverUrl: "https://upload.wikimedia.org/The_Haçienda.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/The_Haçienda-thumb.jpg",
      wikipediaUrl: "https://en.wikipedia.org/wiki/The_Haçienda",
      coordinates: { lat: 53.474, lng: -2.246 },
    });
  });

  it("includes location fields when searching for place nodes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = urlFromFetchInput(input);
      if (url.pathname === "/w/api.php") {
        return new Response(JSON.stringify({ query: { search: [{ title: "The Haçienda" }] } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(wikiSummary("The_Haçienda")), { status: 200 });
    });

    await fetchWikipediaPlaceEnrichment(
      makeItem({
        searchHint: {
          title: "The Haçienda",
          location: { city: "Manchester", country: "England", address: "Whitworth Street West" },
        },
      }),
    );

    const searchUrl = fetchMock.mock.calls
      .map(([input]) => urlFromFetchInput(input))
      .find((url) => url.pathname === "/w/api.php");

    expect(searchUrl?.searchParams.get("srsearch")).toBe(
      "The Haçienda Whitworth Street West Manchester England",
    );
  });

  it("preserves event start date on Wikipedia event enrichment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(wikiSummary("Festival_of_Britain")), { status: 200 }),
    );

    const media = await fetchWikipediaEventEnrichment(
      makeItem({
        name: "Festival of Britain",
        type: "event",
        connectionType: "catalyst",
        searchHint: {
          title: "Festival of Britain",
          wikiSlug: "Festival_of_Britain",
          dateRange: { start: "1951-05-03", end: "1951-09-30" },
        },
      }),
    );

    expect(media.eventDate).toBe("1951-05-03");
    expect(media.thumbnailUrl).toBe("https://upload.wikimedia.org/Festival_of_Britain-thumb.jpg");
  });
});
