// Wikidata is the spine of Culture Tree search (ADR 0004): it supplies both the canonical
// entity and the notability ranking. Search is `wbsearchentities` (fuzzy/alias candidate
// recall) → `wbgetentities` (claims + sitelinks), then candidates are classified by `P31`
// ("instance of") into Branch Types and ranked by **sitelink count** (number of Wikipedia
// language editions) — a single, cross-medium notability axis. Specialists (TMDB / Cover Art
// Archive / Open Library) supply only the cover media a bare Wikidata item lacks.
//
// Etiquette: send a descriptive User-Agent; `wbgetentities` takes up to 50 ids per call, so a
// search is two requests. Callers cache aggressively (the entity store / enrichment cache).
import type { NodeTypeValue } from "@repo/schemas";

import { coverArtFrontUrl } from "./musicbrainz";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath";
const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b";

// Short/common-word queries ("bowie", "It") bury the notable entity below places and common
// nouns, so candidate recall needs a generous limit; sitelink ranking then floats the right
// one up. Validated in the ADR 0004 spike: 50 surfaces David Bowie and King's *It*.
export const WIKIDATA_SEARCH_LIMIT = 50;

// The Wikidata properties this codebase reads. Centralised so the P-codes have names.
export const WD = {
  instanceOf: "P31",
  hasPart: "P527", // franchise / series → its member works (the franchise-expansion link)
  author: "P50", // books
  performer: "P175", // albums / songs
  director: "P57", // film / tv
  publicationDate: "P577",
  image: "P18", // Commons filename
  isbn13: "P212",
  isbn10: "P957",
  openLibraryId: "P648",
  musicBrainzReleaseGroupId: "P436",
  musicBrainzArtistId: "P434",
  tmdbMovieId: "P4947",
  tmdbTvId: "P4983",
  tmdbPersonId: "P4985",
} as const;

// Curated `P31` → Branch Type map. Only the eight core work + creator types are classified;
// `place`/`event`/`article`/`podcast` are deliberately left unmapped (ADR 0004) so a bare
// keyword search doesn't flood the gallery with towns and countries. Unmapped = dropped =
// the noise filter. QIDs verified against representative entities; iterate all P31 statements
// and take the first that maps (e.g. The Lord of the Rings carries four P31s, one of them a
// literary work).
const P31_TO_TYPE = new Map<string, NodeTypeValue>([
  // books / written works
  ["Q7725634", "book"], // literary work
  ["Q571", "book"], // book
  ["Q47461344", "book"], // written work
  ["Q8261", "book"], // novel
  ["Q1667921", "book"], // novel series
  ["Q149537", "book"], // novella
  ["Q1004", "book"], // comics
  ["Q1760610", "book"], // comic book
  ["Q25379", "book"], // play (dramatic work)
  ["Q5185279", "book"], // poem
  ["Q47461344", "book"], // written work
  // film
  ["Q11424", "film"], // film
  ["Q202866", "film"], // animated film
  ["Q24856", "film"], // film series
  ["Q506240", "film"], // television film
  ["Q24862", "film"], // short film
  ["Q17517379", "film"], // animated short film
  ["Q93204", "film"], // documentary film
  ["Q229390", "film"], // 3D film
  // television
  ["Q5398426", "tv"], // television series
  ["Q1259759", "tv"], // miniseries
  ["Q15416", "tv"], // television program
  ["Q581714", "tv"], // animated series
  ["Q117467246", "tv"], // animated television series
  // music — recordings
  ["Q482994", "album"], // album
  ["Q208569", "album"], // studio album
  ["Q222910", "album"], // live album
  ["Q209939", "album"], // compilation album
  ["Q605340", "album"], // extended play (EP)
  ["Q7366", "song"], // song
  ["Q134556", "song"], // single
  ["Q105543609", "song"], // musical work/composition
  ["Q2188189", "song"], // musical work
  // people
  ["Q5", "person"], // human
  // musical groups / artists
  ["Q215380", "artist"], // musical group
  ["Q2088357", "artist"], // musical ensemble
  ["Q5741069", "artist"], // rock band
  // artworks
  ["Q3305213", "artwork"], // painting
  ["Q860861", "artwork"], // sculpture
  ["Q838948", "artwork"], // work of art
  ["Q11060274", "artwork"], // print
]);

const WORK_TYPES = new Set<NodeTypeValue>(["book", "film", "tv", "album", "song", "artwork"]);
const CREATOR_TYPES = new Set<NodeTypeValue>(["person", "artist"]);

export function isWorkType(type: NodeTypeValue): boolean {
  return WORK_TYPES.has(type);
}

export function isCreatorType(type: NodeTypeValue): boolean {
  return CREATOR_TYPES.has(type);
}

// Franchise "hub" `P31` types. These are themselves unmapped (left out of P31_TO_TYPE, so they
// never surface as Branches — ADR 0004 noise filter), but they collect a franchise's member
// works under P527. A keyword search recalls only works whose *title* contains the query, so a
// franchise's differently-titled siblings (e.g. the "DreamWorks Dragons" TV series under the
// "How to Train Your Dragon" franchise) are invisible to text search — expanding the hub's P527
// is the second recall path that surfaces them.
const FRANCHISE_HUB_TYPES = new Set<string>([
  "Q196600", // media franchise
  "Q559618", // fictional universe
]);

// Whether an entity is a franchise hub worth expanding into its P527 member works.
export function isFranchiseHub(entity: WikidataEntity): boolean {
  for (const statement of statements(entity.claims, WD.instanceOf)) {
    const id = (statement.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id;
    if (id && FRANCHISE_HUB_TYPES.has(id)) {
      return true;
    }
  }
  return false;
}

type WikidataSnak = {
  datavalue?: { value?: unknown; type?: string };
};

type WikidataStatement = { mainsnak?: WikidataSnak };

export type WikidataClaims = Record<string, WikidataStatement[] | undefined>;

export type WikidataEntity = {
  id: string;
  label?: string;
  description?: string;
  /** Number of Wikipedia language editions — the notability ranking signal. */
  sitelinks: number;
  claims: WikidataClaims;
};

function userAgent(): string {
  return (
    process.env.WIKIDATA_USER_AGENT?.trim() ||
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "CultureTree/0.1 (https://culturetree.app; search)"
  );
}

async function wikidataFetch(params: Record<string, string>): Promise<unknown> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent() } });
    if (!response.ok) {
      console.warn(`[search] Wikidata ${params.action} failed (HTTP ${response.status}).`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[search] Wikidata ${params.action} errored.`, error);
    return null;
  }
}

// Candidate QIDs for a query, in Wikidata's own relevance order (used only as a tie-break;
// real ranking is by sitelink count downstream).
export async function searchWikidataEntities(
  query: string,
  limit: number = WIKIDATA_SEARCH_LIMIT,
): Promise<string[]> {
  const data = (await wikidataFetch({
    action: "wbsearchentities",
    search: query,
    language: "en",
    uselang: "en",
    type: "item",
    limit: String(limit),
  })) as { search?: Array<{ id?: string }> } | null;
  return (data?.search ?? []).map((hit) => hit.id).filter((id): id is string => Boolean(id));
}

// Full entities (labels, descriptions, claims, sitelink counts) for up to 50 QIDs in one
// call, returned in the input order so the caller keeps Wikidata's relevance tie-break.
export async function fetchWikidataEntities(qids: string[]): Promise<WikidataEntity[]> {
  if (qids.length === 0) {
    return [];
  }
  const batch = qids.slice(0, 50);
  const data = (await wikidataFetch({
    action: "wbgetentities",
    ids: batch.join("|"),
    props: "labels|descriptions|claims|sitelinks",
    languages: "en",
  })) as {
    entities?: Record<
      string,
      {
        id?: string;
        labels?: { en?: { value?: string } };
        descriptions?: { en?: { value?: string } };
        claims?: WikidataClaims;
        sitelinks?: Record<string, unknown>;
      }
    >;
  } | null;
  const entities = data?.entities ?? {};
  return batch
    .map((qid) => entities[qid])
    .filter((raw): raw is NonNullable<typeof raw> => Boolean(raw?.id))
    .map((raw) => ({
      id: raw.id as string,
      label: raw.labels?.en?.value,
      description: raw.descriptions?.en?.value,
      sitelinks: raw.sitelinks ? Object.keys(raw.sitelinks).length : 0,
      claims: raw.claims ?? {},
    }));
}

// The English Wikipedia article title for a QID (its `enwiki` sitelink), or undefined. Lets a
// creator's bio be pulled from the *exact* article (one wbgetentities call, sitelinks only)
// rather than a fuzzy name search that could land on a namesake.
export async function fetchWikidataEnwikiTitle(qid: string): Promise<string | undefined> {
  const data = (await wikidataFetch({
    action: "wbgetentities",
    ids: qid,
    props: "sitelinks",
    sitefilter: "enwiki",
  })) as {
    entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
  } | null;
  const title = data?.entities?.[qid]?.sitelinks?.enwiki?.title;
  return title?.trim() || undefined;
}

// ---- pure claim readers -------------------------------------------------------------------

function statements(claims: WikidataClaims, prop: string): WikidataStatement[] {
  return claims[prop] ?? [];
}

// A referenced entity's QID (wikibase-item value), e.g. P50 author → "Q...".
export function claimEntityId(claims: WikidataClaims, prop: string): string | undefined {
  for (const statement of statements(claims, prop)) {
    const value = statement.mainsnak?.datavalue?.value as { id?: string } | undefined;
    if (value?.id) {
      return value.id;
    }
  }
  return undefined;
}

// Every referenced entity QID for a multi-valued property, in statement order, e.g. P527
// has-part → all of a franchise's member works.
export function claimEntityIds(claims: WikidataClaims, prop: string): string[] {
  const ids: string[] = [];
  for (const statement of statements(claims, prop)) {
    const value = statement.mainsnak?.datavalue?.value as { id?: string } | undefined;
    if (value?.id) {
      ids.push(value.id);
    }
  }
  return ids;
}

// A plain string value (external-id / commons-media / string datatypes), e.g. P436 MBID.
export function claimString(claims: WikidataClaims, prop: string): string | undefined {
  for (const statement of statements(claims, prop)) {
    const value = statement.mainsnak?.datavalue?.value;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

// The four-digit year from a P577 (time) claim, e.g. "+1965-00-00T00:00:00Z" → 1965.
export function yearFromClaims(claims: WikidataClaims): number | undefined {
  for (const statement of statements(claims, WD.publicationDate)) {
    const value = statement.mainsnak?.datavalue?.value as { time?: string } | undefined;
    const match = value?.time?.match(/([+-])(\d{4})/);
    if (match?.[2]) {
      const year = Number.parseInt(match[2], 10);
      if (Number.isFinite(year) && year > 0) {
        return year;
      }
    }
  }
  return undefined;
}

// First P31 that maps to a core Branch Type, else null (unmapped → dropped as noise).
export function classifyWikidataType(entity: WikidataEntity): NodeTypeValue | null {
  for (const statement of statements(entity.claims, WD.instanceOf)) {
    const id = (statement.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id;
    const type = id ? P31_TO_TYPE.get(id) : undefined;
    if (type) {
      return type;
    }
  }
  return null;
}

// The creator-credit property for a work type (author / performer / director).
export function creatorPropertyForType(type: NodeTypeValue): string | undefined {
  if (type === "book") {
    return WD.author;
  }
  if (type === "album" || type === "song") {
    return WD.performer;
  }
  if (type === "film" || type === "tv") {
    return WD.director;
  }
  return undefined;
}

// Wikidata descriptions reliably embed the creator ("1965 studio album **by the Beatles**",
// "1965 science fiction novel **by Frank Herbert**"), so search can show a creator subtitle
// without an extra label fetch. Mint time resolves the real P50/P175/P57 entity for the
// canonical record.
export function creatorHintFromDescription(description: string | undefined): string | undefined {
  const match = description?.match(/\bby\s+([^,.;()]+)/i);
  const creator = match?.[1]?.trim().replace(/^the\s+/i, "");
  return creator || undefined;
}

// ---- cover URL constructors (no network; the browser loads them, CoverImage 404-falls-back) ----

// Commons image from a P18 filename, sized via Special:FilePath (handles spaces/encoding).
export function commonsImageUrl(filename: string, width = 500): string {
  return `${COMMONS_FILEPATH}/${encodeURIComponent(filename.replace(/ /g, "_"))}?width=${width}`;
}

export function openLibraryIsbnCoverUrl(isbn: string): string {
  return `${OPEN_LIBRARY_COVERS}/isbn/${encodeURIComponent(isbn.replace(/[^0-9Xx]/g, ""))}-L.jpg`;
}

export function openLibraryOlidCoverUrl(olid: string): string {
  return `${OPEN_LIBRARY_COVERS}/olid/${encodeURIComponent(olid)}-L.jpg`;
}

// The best constructible cover URL for an entity (no network — the browser loads it and
// CoverImage 404-falls-back to a placeholder): album → Cover Art Archive (via P436); book →
// Open Library (ISBN, then OLID); everything else → the item's own Commons image (P18). Film
// and TV get a real TMDB poster from an enricher that has the credentials; this is their
// fallback. Shared by search ranking and add-time minting so both build covers identically.
export function buildWikidataCover(
  entity: WikidataEntity,
  type: NodeTypeValue,
): string | undefined {
  const { claims } = entity;
  if (type === "album") {
    const mbid = claimString(claims, WD.musicBrainzReleaseGroupId);
    if (mbid) {
      return coverArtFrontUrl(mbid);
    }
  }
  if (type === "book") {
    const isbn = claimString(claims, WD.isbn13) ?? claimString(claims, WD.isbn10);
    if (isbn) {
      return openLibraryIsbnCoverUrl(isbn);
    }
    const olid = claimString(claims, WD.openLibraryId);
    if (olid) {
      return openLibraryOlidCoverUrl(olid);
    }
  }
  const commons = claimString(claims, WD.image);
  return commons ? commonsImageUrl(commons) : undefined;
}
