import { describe, expect, it } from "vite-plus/test";

import {
  primarySourceForType,
  sourceCanCreateEntityForType,
} from "./entity-resolution-authorities";

describe("Entity resolution authorities", () => {
  it("uses TMDB for film and TV entities", () => {
    expect(primarySourceForType("film")).toBe("tmdb");
    expect(sourceCanCreateEntityForType("tmdb", "film")).toBe(true);
    expect(sourceCanCreateEntityForType("wikipedia", "film")).toBe(false);
  });

  it("uses MusicBrainz for music entities", () => {
    expect(primarySourceForType("album")).toBe("musicbrainz");
    expect(sourceCanCreateEntityForType("musicbrainz", "song")).toBe(true);
    expect(sourceCanCreateEntityForType("wikipedia", "artist")).toBe(false);
  });

  it("uses Wikipedia for fallback cultural reference entities", () => {
    expect(primarySourceForType("place")).toBe("wikipedia");
    expect(sourceCanCreateEntityForType("wikipedia", "event")).toBe(true);
    expect(sourceCanCreateEntityForType("wikipedia", "article")).toBe(false);
  });
});
