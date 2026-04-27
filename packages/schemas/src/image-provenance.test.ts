import { describe, expect, it } from "vite-plus/test";

import { buildImageProvenance, inferImageProvenanceFromUrl } from "./image-provenance";

const CHECKED_AT = new Date("2026-04-27T12:00:00.000Z");

describe("image provenance", () => {
  it("builds normalized provenance for provider images", () => {
    expect(
      buildImageProvenance({
        source: "tmdb",
        kind: "poster",
        remoteUrl: " https://image.tmdb.org/t/p/w500/poster.jpg ",
        attributionUrl: " https://www.themoviedb.org/movie/550 ",
        providerAssetId: " /poster.jpg ",
        checkedAt: CHECKED_AT,
      }),
    ).toEqual({
      source: "tmdb",
      kind: "poster",
      remoteUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
      attributionUrl: "https://www.themoviedb.org/movie/550",
      providerAssetId: "/poster.jpg",
      rightsStatus: "provider-supplied",
      checkedAt: "2026-04-27T12:00:00.000Z",
    });
  });

  it("returns no provenance without an image URL", () => {
    expect(
      buildImageProvenance({
        source: "tmdb",
        kind: "poster",
        checkedAt: CHECKED_AT,
      }),
    ).toBeUndefined();
  });

  it("infers obvious provider URLs and leaves unknown URLs classified", () => {
    expect(
      inferImageProvenanceFromUrl({
        remoteUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
        checkedAt: CHECKED_AT,
      }),
    ).toMatchObject({ source: "tmdb", kind: "poster" });

    expect(
      inferImageProvenanceFromUrl({
        remoteUrl: "https://upload.wikimedia.org/wikipedia/commons/image.jpg",
        checkedAt: CHECKED_AT,
      }),
    ).toMatchObject({ source: "wikipedia", kind: "lead-image" });

    expect(
      inferImageProvenanceFromUrl({
        remoteUrl: "https://example.com/cover.jpg",
        checkedAt: CHECKED_AT,
      }),
    ).toMatchObject({ source: "unknown", kind: "unknown", rightsStatus: "unknown" });
  });
});
