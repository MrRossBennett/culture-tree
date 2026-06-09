import { describe, expect, it } from "vite-plus/test";

import {
  primarySourceForType,
  sourceCanCreateEntityForType,
} from "./entity-resolution-authorities";

describe("Entity resolution authorities", () => {
  it("mints identity-less items via the Wikidata spine for every type (ADR 0004)", () => {
    expect(primarySourceForType("film")).toBe("wikidata");
    expect(primarySourceForType("album")).toBe("wikidata");
    expect(primarySourceForType("book")).toBe("wikidata");
    expect(primarySourceForType("place")).toBe("wikidata");
    expect(sourceCanCreateEntityForType("wikidata", "film")).toBe(true);
    expect(sourceCanCreateEntityForType("wikidata", "book")).toBe(true);
    expect(sourceCanCreateEntityForType("wikidata", "artwork")).toBe(true);
  });

  it("still lets specialists mint the works that creator expansion produces directly", () => {
    // TMDB filmography / MusicBrainz discography results carry the specialist's own identity.
    expect(sourceCanCreateEntityForType("tmdb", "film")).toBe(true);
    expect(sourceCanCreateEntityForType("musicbrainz", "song")).toBe(true);
  });

  it("does not let a specialist mint a type it is not authoritative for", () => {
    expect(sourceCanCreateEntityForType("tmdb", "book")).toBe(false);
    expect(sourceCanCreateEntityForType("musicbrainz", "film")).toBe(false);
    expect(sourceCanCreateEntityForType("wikipedia", "film")).toBe(false);
  });
});
