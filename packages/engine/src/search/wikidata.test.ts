import { describe, expect, it } from "vite-plus/test";

import {
  type WikidataEntity,
  classifyWikidataType,
  claimEntityId,
  claimEntityIds,
  claimString,
  commonsImageUrl,
  creatorHintFromDescription,
  creatorPropertyForType,
  isFranchiseHub,
  openLibraryIsbnCoverUrl,
  openLibraryOlidCoverUrl,
  yearFromClaims,
} from "./wikidata";

// Minimal P31 statement builder.
function instanceOf(...qids: string[]): WikidataEntity["claims"] {
  return {
    P31: qids.map((id) => ({
      mainsnak: { datavalue: { value: { id }, type: "wikibase-entityid" } },
    })),
  };
}

function entity(
  claims: WikidataEntity["claims"],
  extras: Partial<WikidataEntity> = {},
): WikidataEntity {
  return { id: "Q1", sitelinks: 0, claims, ...extras };
}

describe("classifyWikidataType", () => {
  it("maps the core work and creator types from their P31", () => {
    expect(classifyWikidataType(entity(instanceOf("Q7725634")))).toBe("book"); // literary work
    expect(classifyWikidataType(entity(instanceOf("Q1667921")))).toBe("book"); // novel series
    expect(classifyWikidataType(entity(instanceOf("Q11424")))).toBe("film");
    expect(classifyWikidataType(entity(instanceOf("Q202866")))).toBe("film"); // animated film
    expect(classifyWikidataType(entity(instanceOf("Q5398426")))).toBe("tv");
    expect(classifyWikidataType(entity(instanceOf("Q117467246")))).toBe("tv"); // animated TV series
    expect(classifyWikidataType(entity(instanceOf("Q482994")))).toBe("album");
    expect(classifyWikidataType(entity(instanceOf("Q134556")))).toBe("song"); // single
    expect(classifyWikidataType(entity(instanceOf("Q3305213")))).toBe("artwork"); // painting
    expect(classifyWikidataType(entity(instanceOf("Q5")))).toBe("person"); // human
    expect(classifyWikidataType(entity(instanceOf("Q215380")))).toBe("artist"); // musical group
  });

  it("skips unmapped P31s and takes the first that maps (e.g. The Lord of the Rings)", () => {
    // LOTR carries several P31s; the leading unmapped ones are skipped and the literary-work maps.
    expect(classifyWikidataType(entity(instanceOf("Q13593966", "Q7725310", "Q7725634")))).toBe(
      "book",
    );
  });

  it("drops unmapped (non-cultural) types so they are filtered as noise", () => {
    expect(classifyWikidataType(entity(instanceOf("Q515")))).toBeNull(); // city
    expect(classifyWikidataType(entity(instanceOf("Q3186692")))).toBeNull(); // calendar year
    expect(classifyWikidataType(entity({}))).toBeNull(); // no P31
  });
});

describe("isFranchiseHub", () => {
  it("recognises media franchises and fictional universes (the P527 expansion hubs)", () => {
    expect(isFranchiseHub(entity(instanceOf("Q196600")))).toBe(true); // media franchise
    expect(isFranchiseHub(entity(instanceOf("Q559618")))).toBe(true); // fictional universe
  });

  it("does not treat a classified work as a hub", () => {
    expect(isFranchiseHub(entity(instanceOf("Q11424")))).toBe(false); // film
    expect(isFranchiseHub(entity(instanceOf("Q5398426")))).toBe(false); // tv series
    expect(isFranchiseHub(entity({}))).toBe(false); // no P31
  });
});

describe("claim readers", () => {
  it("reads referenced entity ids and plain string values", () => {
    const claims = {
      P50: [{ mainsnak: { datavalue: { value: { id: "Q123" }, type: "wikibase-entityid" } } }],
      P436: [{ mainsnak: { datavalue: { value: "mbid-abc", type: "external-id" } } }],
    };
    expect(claimEntityId(claims, "P50")).toBe("Q123");
    expect(claimString(claims, "P436")).toBe("mbid-abc");
    expect(claimEntityId(claims, "P999")).toBeUndefined();
    expect(claimString(claims, "P999")).toBeUndefined();
  });

  it("reads every referenced id of a multi-valued property (P527 has-part)", () => {
    const claims = {
      P527: [
        { mainsnak: { datavalue: { value: { id: "Q1" }, type: "wikibase-entityid" } } },
        { mainsnak: { datavalue: { value: { id: "Q2" }, type: "wikibase-entityid" } } },
      ],
    };
    expect(claimEntityIds(claims, "P527")).toEqual(["Q1", "Q2"]);
    expect(claimEntityIds(claims, "P999")).toEqual([]);
  });

  it("extracts a four-digit year from a P577 time claim", () => {
    const claims = {
      P577: [
        { mainsnak: { datavalue: { value: { time: "+1965-00-00T00:00:00Z" }, type: "time" } } },
      ],
    };
    expect(yearFromClaims(claims)).toBe(1965);
    expect(yearFromClaims({})).toBeUndefined();
  });
});

describe("creator helpers", () => {
  it("maps a work type to its creator-credit property", () => {
    expect(creatorPropertyForType("book")).toBe("P50");
    expect(creatorPropertyForType("album")).toBe("P175");
    expect(creatorPropertyForType("film")).toBe("P57");
    expect(creatorPropertyForType("person")).toBeUndefined();
  });

  it("pulls a creator hint from the Wikidata description", () => {
    expect(creatorHintFromDescription("1965 studio album by the Beatles")).toBe("Beatles");
    expect(creatorHintFromDescription("1965 science fiction novel by Frank Herbert")).toBe(
      "Frank Herbert",
    );
    expect(creatorHintFromDescription("oil painting in the Louvre")).toBeUndefined();
  });
});

describe("cover URL constructors", () => {
  it("builds Commons, Open Library ISBN, and Open Library OLID URLs", () => {
    expect(commonsImageUrl("David Bowie.jpg")).toContain(
      "Special:FilePath/David_Bowie.jpg?width=500",
    );
    expect(openLibraryIsbnCoverUrl("978-0-441-01359-3")).toBe(
      "https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg",
    );
    expect(openLibraryOlidCoverUrl("OL12345M")).toBe(
      "https://covers.openlibrary.org/b/olid/OL12345M-L.jpg",
    );
  });
});
