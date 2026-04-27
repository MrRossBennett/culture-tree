import { describe, expect, it } from "vite-plus/test";

import { mergeEntityMetadata } from "./entity-metadata";

const imageProvenance = {
  source: "tmdb" as const,
  kind: "poster" as const,
  remoteUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
  attributionUrl: "https://www.themoviedb.org/movie/550",
  rightsStatus: "provider-supplied" as const,
  checkedAt: "2026-04-27T12:00:00.000Z",
};

describe("entity metadata", () => {
  it("preserves existing image provenance when incoming metadata does not touch it", () => {
    expect(
      mergeEntityMetadata(
        { searchHint: { title: "Old" }, imageProvenance, other: "keep" },
        { searchHint: { title: "New" } },
      ),
    ).toEqual({
      searchHint: { title: "New" },
      imageProvenance,
      other: "keep",
    });
  });

  it("updates image provenance when incoming metadata provides a replacement", () => {
    const replacement = {
      ...imageProvenance,
      source: "wikipedia" as const,
      kind: "lead-image" as const,
      remoteUrl: "https://upload.wikimedia.org/image.jpg",
    };

    expect(
      mergeEntityMetadata({ imageProvenance, other: "keep" }, { imageProvenance: replacement }),
    ).toEqual({
      imageProvenance: replacement,
      other: "keep",
    });
  });
});
