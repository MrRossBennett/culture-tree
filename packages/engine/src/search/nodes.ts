// Culture Tree search, on the Wikidata spine (ADR 0004). One source, one ranking axis:
// `wbsearchentities` recalls candidates, `wbgetentities` supplies claims + sitelinks, each
// candidate is classified by P31 into a Branch Type and ranked by **sitelink count** (a
// single cross-medium notability signal). Specialists only fill the cover a bare Wikidata
// item lacks: film/TV posters → TMDB; album covers → Cover Art Archive; book covers → Open
// Library; everything else → the item's Commons image (P18).
//
// Results are a flat list ranked by notability (medium is a filter, not a forced section).
// Both works (addable) and creators (addable *and* expandable into their works) are surfaced;
// nothing is destructively suppressed — the most notable thing simply leads.
//
// Recall has two paths. (1) Text: `wbsearchentities` matches the query against labels/aliases.
// (2) Franchise expansion: a keyword only recalls works whose *title* contains it, so a
// franchise's differently-titled siblings (the "DreamWorks Dragons" TV series under the "How to
// Train Your Dragon" franchise) are invisible to text search. When a franchise hub turns up in
// the text candidates, its P527 member works are pulled in as extra candidates, then classified
// and ranked on the same notability axis as everything else.
import type { ExternalNodeSearchResult, NodeTypeValue, TreeNodeIdentity } from "@repo/schemas";

import { fetchSummaryByTitle } from "../enrichment/wikipedia";
import { fetchItunesArtistAlbumCovers, fetchItunesCover, normalizeAlbumTitle } from "./itunes";
import {
  coverArtFrontUrl,
  fetchMusicBrainzArtistAlbums,
  type MusicBrainzReleaseGroup,
} from "./musicbrainz";
import {
  WD,
  buildWikidataCover,
  classifyWikidataType,
  claimEntityIds,
  claimString,
  creatorHintFromDescription,
  fetchWikidataEnwikiTitle,
  fetchWikidataEntities,
  isCreatorType,
  isFranchiseHub,
  searchWikidataEntities,
  yearFromClaims,
  type WikidataEntity,
} from "./wikidata";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
// A resolved creator's studio discography (MusicBrainz) and filmography (TMDB) on expand.
// MusicBrainz pages internally to gather a complete studio discography up to this cap; 75 covers
// even prolific artists' studio albums while bounding the rare outlier (a few hundred RGs).
const MUSICBRAINZ_ARTIST_ALBUMS_LIMIT = 75;
// TMDB's combined_credits returns a creator's *entire* filmography in one call (no pagination)
// with poster paths embedded, so a comprehensive list costs no extra request — Peter Fonda's 126
// films match Letterboxd exactly. This cap isn't an API bound; it's a payload/render safety net
// for pathological cases (prolific character actors carry 500+ credits, many of them long-tail
// noise — uncredited bits, archive footage, "self" appearances). Sorted by popularity first, so
// the cap only ever trims the least-notable tail.
const TMDB_CREDITS_LIMIT = 200;

// An exact label match leads ranking, but only if it's a *real* entity (≥ this many Wikipedia
// editions) — otherwise an obscure work titled exactly the query (a 1-sitelink booklet named
// "Bowie") would beat a hugely notable prefix match (David Bowie). Not competitor-calibrated:
// it just distinguishes a genuine exact match from junk.
const EXACT_MATCH_NOTABILITY_FLOOR = 5;

// The long-tail noise floor: drop classified results below this many Wikipedia language editions.
// A creator query like "David Bowie" otherwise drags in a 1-sitelink banker, fan-made tribute
// paintings, and obscure namesakes — all ≤1 sitelink. "In fewer than 2 Wikipedia editions" is,
// by our own notability definition, not a Branch. Guarded so a genuinely niche query that has
// only low-notability matches still returns them rather than nothing.
const MIN_SITELINKS_TO_SURFACE = 2;

// Cap on franchise member works pulled in per search. wbgetentities takes 50 ids per call, so
// one extra batch bounds the work to a single request even for a sprawling franchise; the
// sitelink floor and notability ranking downstream keep only the member works worth showing.
const FRANCHISE_MEMBERS_LIMIT = 50;

// Flip to "0" to silence the per-search result dump.
const DEBUG_SEARCH = process.env.DEBUG_SEARCH !== "0";

type RankedResult = {
  result: ExternalNodeSearchResult;
  /** Number of Wikipedia language editions — the primary notability ranking signal. */
  sitelinks: number;
  /** Whether the item's label equals the query — a strong intent signal that leads ranking. */
  exact: boolean;
  type: NodeTypeValue;
  /** The source Wikidata item, kept through ranking so cover enrichers can read its claims. */
  entity: WikidataEntity;
};

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMeta(parts: Array<string | number | undefined>): string | undefined {
  const values = parts.map((part) => (part == null ? "" : String(part).trim())).filter(Boolean);
  return values.length > 0 ? values.join(" • ") : undefined;
}

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(/\b(\d{4})\b/);
  const year = match?.[1] ? Number.parseInt(match[1], 10) : undefined;
  return year && Number.isFinite(year) ? year : undefined;
}

// ---- TMDB (covers for film/TV; person expansion) -----------------------------------------

function hasTmdbCredentials(): boolean {
  return Boolean(process.env.TMDB_ACCESS_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim());
}

function tmdbFetchInit(url: URL): RequestInit {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (token) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }
  return { headers: {} };
}

type TmdbCreditItem = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
  department?: string;
};

type TmdbPersonItem = {
  id?: number;
  name?: string;
  known_for_department?: string;
};

// The real poster for a film/TV item, fetched by its TMDB id (read from Wikidata P4947/P4983).
// TMDB exposes no constructible poster URL, so this single call is required — bounded to the
// film/TV candidates actually shown.
async function fetchTmdbPoster(mediaType: "movie" | "tv", id: string): Promise<string | undefined> {
  const url = new URL(`${TMDB_BASE}/${mediaType}/${id}`);
  try {
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as { poster_path?: string | null };
    return data.poster_path ? `${TMDB_IMG}/w500${data.poster_path}` : undefined;
  } catch {
    return undefined;
  }
}

async function fetchTmdbPersonById(personId: string): Promise<TmdbPersonItem | null> {
  const url = new URL(`${TMDB_BASE}/person/${personId}`);
  try {
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TmdbPersonItem;
  } catch {
    return null;
  }
}

// A creator's filmography, ranked by each work's own popularity (movies only, Phase 1).
// Directors/writers/producers are credited in `crew` under their department; actors in `cast`.
async function fetchTmdbPersonCredits(person: TmdbPersonItem): Promise<ExternalNodeSearchResult[]> {
  if (person.id == null) {
    return [];
  }
  const url = new URL(`${TMDB_BASE}/person/${person.id}/combined_credits`);
  let data: { cast?: TmdbCreditItem[]; crew?: TmdbCreditItem[] };
  try {
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return [];
    }
    data = (await response.json()) as { cast?: TmdbCreditItem[]; crew?: TmdbCreditItem[] };
  } catch {
    return [];
  }
  const primaryDept = person.known_for_department;
  const chosen =
    primaryDept && primaryDept !== "Acting"
      ? (data.crew ?? []).filter((credit) => credit.department === primaryDept)
      : (data.cast ?? []);
  const pool = chosen.length > 0 ? chosen : [...(data.cast ?? []), ...(data.crew ?? [])];
  const byId = new Map<string, TmdbCreditItem>();
  for (const credit of pool) {
    if (credit.id == null || credit.media_type !== "movie") {
      continue;
    }
    const key = `movie:${credit.id}`;
    const existing = byId.get(key);
    if (!existing || (credit.popularity ?? 0) > (existing.popularity ?? 0)) {
      byId.set(key, credit);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, TMDB_CREDITS_LIMIT)
    .map((credit) => tmdbCreditToResult(credit, person.name))
    .filter((result): result is ExternalNodeSearchResult => result != null);
}

function tmdbCreditToResult(
  credit: TmdbCreditItem,
  creator: string | undefined,
): ExternalNodeSearchResult | null {
  if (credit.id == null || credit.media_type !== "movie") {
    return null;
  }
  const name = credit.title?.trim();
  if (!name) {
    return null;
  }
  const year = parseYear(credit.release_date);
  const image = credit.poster_path ? `${TMDB_IMG}/w500${credit.poster_path}` : undefined;
  return {
    kind: "addable-work",
    identity: { source: "tmdb", externalId: `movie:${credit.id}` },
    snapshot: { name, type: "film", year, image },
    searchHint: { title: name, creator: creator?.trim() || undefined },
    meta: pickMeta([creator?.trim(), year]),
    externalUrl: `https://www.themoviedb.org/movie/${credit.id}`,
  };
}

// ---- result building ----------------------------------------------------------------------

function entityToRanked(
  entity: WikidataEntity,
  type: NodeTypeValue,
  query: string,
): RankedResult | null {
  const name = entity.label?.trim();
  if (!name) {
    return null;
  }
  const year = yearFromClaims(entity.claims);
  const creator = creatorHintFromDescription(entity.description);
  const image = buildWikidataCover(entity, type);
  const result: ExternalNodeSearchResult = {
    kind: isCreatorType(type) ? "expandable-subject" : "addable-work",
    identity: { source: "wikidata", externalId: entity.id },
    snapshot: { name, type, year, image },
    searchHint: { title: name, creator },
    meta: entity.description?.trim() || pickMeta([creator, year]),
    externalUrl: `https://www.wikidata.org/wiki/${entity.id}`,
  };
  const exact = normalizeTitle(name) === normalizeTitle(query);
  return { result, sitelinks: entity.sitelinks, exact, type, entity };
}

// Fetch real posters for the film/TV candidates that will be shown, overriding the Commons
// fallback. Bounded and parallel; skipped without TMDB credentials (Commons fallback stands).
async function enrichFilmPosters(ranked: RankedResult[]): Promise<void> {
  if (!hasTmdbCredentials()) {
    return;
  }
  await Promise.all(
    ranked.map(async (item) => {
      if (item.type !== "film" && item.type !== "tv") {
        return;
      }
      const tmdbProp = item.type === "film" ? WD.tmdbMovieId : WD.tmdbTvId;
      const tmdbId = claimString(item.entity.claims, tmdbProp);
      if (!tmdbId) {
        return;
      }
      const poster = await fetchTmdbPoster(item.type === "film" ? "movie" : "tv", tmdbId);
      if (poster) {
        item.result.snapshot.image = poster;
      }
    }),
  );
}

// Replace the Cover Art Archive fallback with clean Apple storefront art for the album/song
// candidates shown, when a confident artist+title match exists. CAA stands when Apple declines
// (no match / rate-limited), so a result never loses its cover — it only upgrades. Bounded to
// the few music results in a mixed gallery and run in parallel.
async function enrichAlbumCovers(ranked: RankedResult[]): Promise<void> {
  await Promise.all(
    ranked.map(async (item) => {
      if (item.type !== "album" && item.type !== "song") {
        return;
      }
      const cover = await fetchItunesCover(
        item.type,
        item.result.searchHint.creator,
        item.result.snapshot.name,
      );
      if (cover) {
        item.result.snapshot.image = cover;
      }
    }),
  );
}

function logSearch(query: string, ranked: RankedResult[]): void {
  if (!DEBUG_SEARCH) {
    return;
  }
  console.log(`\n[search] query="${query}" — ${ranked.length} result(s), ranked by sitelinks:`);
  for (const item of ranked) {
    const { snapshot, searchHint } = item.result;
    console.log(
      `  ${String(item.sitelinks).padStart(4)}sl  ${snapshot.type.padEnd(7)} ${snapshot.name}` +
        `${searchHint.creator ? ` — ${searchHint.creator}` : ""}` +
        `${snapshot.year ? ` (${snapshot.year})` : ""}  [${item.result.identity.externalId}]`,
    );
  }
  console.log("");
}

// The franchise siblings the text search missed: gather the P527 members of every franchise hub
// among the text candidates, drop the ones we already fetched, and fetch the rest in one bounded
// wbgetentities call. Returns [] (no extra request) when no hub is present — the common case.
async function fetchFranchiseMembers(
  entities: WikidataEntity[],
  seen: Set<string>,
): Promise<WikidataEntity[]> {
  const memberIds: string[] = [];
  const queued = new Set<string>();
  for (const entity of entities) {
    if (!isFranchiseHub(entity)) {
      continue;
    }
    for (const id of claimEntityIds(entity.claims, WD.hasPart)) {
      if (!seen.has(id) && !queued.has(id)) {
        queued.add(id);
        memberIds.push(id);
      }
    }
  }
  if (memberIds.length === 0) {
    return [];
  }
  return fetchWikidataEntities(memberIds.slice(0, FRANCHISE_MEMBERS_LIMIT));
}

export async function searchExternalNodes(query: string): Promise<ExternalNodeSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const qids = await searchWikidataEntities(trimmed);
  const textEntities = await fetchWikidataEntities(qids);
  const members = await fetchFranchiseMembers(textEntities, new Set(qids));
  const entities = [...textEntities, ...members];

  const ranked = entities
    .map((entity) => {
      const type = classifyWikidataType(entity);
      return type ? entityToRanked(entity, type, trimmed) : null;
    })
    .filter((item): item is RankedResult => item != null);

  await Promise.all([enrichFilmPosters(ranked), enrichAlbumCovers(ranked)]);

  // Quality floor: drop the barely-notable long tail. Guarded — if every match is below the
  // floor (a genuinely niche query), keep them all rather than returning nothing.
  const floored = ranked.filter((item) => item.sitelinks >= MIN_SITELINKS_TO_SURFACE);
  const surviving = floored.length > 0 ? floored : ranked;

  // Three ranking tiers, each ordered by notability (sitelink count) within:
  //   2 — a *notable* exact-title match leads (a strong intent signal): keeps "It" on the work
  //       titled exactly "It" over a higher-sitelink person whose name merely starts with it,
  //       without letting a junk exact match outrank a famous prefix match.
  //   1 — covered results, so the poster gallery isn't broken up by placeholder cards.
  //   0 — real but imageless works. A *demotion*, not a filter: they still appear, just lower.
  // Stable within a tier: fetchWikidataEntities preserves Wikidata's relevance order. Medium is
  // a UI filter, not a forced section.
  const tier = (item: RankedResult): number => {
    if (item.exact && item.sitelinks >= EXACT_MATCH_NOTABILITY_FLOOR) {
      return 2;
    }
    return item.result.snapshot.image ? 1 : 0;
  };
  surviving.sort((left, right) => tier(right) - tier(left) || right.sitelinks - left.sitelinks);

  logSearch(trimmed, surviving);

  return surviving.map((item) => item.result);
}

// ---- creator expansion (hop two) ----------------------------------------------------------

// Thrown when an expected authority can't be reached (network/503) — distinct from a creator
// who genuinely has no resolvable works. Lets the UI say "couldn't load" vs "no works".
export class SubjectWorksUnavailableError extends Error {
  constructor(source: string) {
    super(`Could not load works from ${source}.`);
    this.name = "SubjectWorksUnavailableError";
  }
}

function releaseGroupToResult(rg: MusicBrainzReleaseGroup): ExternalNodeSearchResult {
  const year = parseYear(rg.firstReleaseDate);
  return {
    kind: "addable-work",
    // Bare release-group MBID — the convention the entity resolver expects for an album.
    identity: { source: "musicbrainz", externalId: rg.id },
    snapshot: { name: rg.title, type: "album", year, image: coverArtFrontUrl(rg.id) },
    searchHint: { title: rg.title, creator: rg.artistName },
    meta: pickMeta([rg.artistName, year]),
    externalUrl: `https://musicbrainz.org/release-group/${rg.id}`,
  };
}

// Resolve a creator (a Wikidata person/artist QID) into their works from the specialists:
// MusicBrainz discography (via P434) and/or TMDB filmography (via P4985). Wikidata identifies
// and ranks the creator; the specialist enumerates the works (Wikidata's own work back-links
// are too patchy). A creator with neither cross-link (e.g. most book authors) simply has no
// expansion — they remain addable as a person.
export async function resolveSearchSubjectWorks(
  identity: TreeNodeIdentity,
): Promise<ExternalNodeSearchResult[]> {
  if (identity.source !== "wikidata") {
    return [];
  }
  const [entity] = await fetchWikidataEntities([identity.externalId]);
  if (!entity) {
    return [];
  }

  const mbArtistId = claimString(entity.claims, WD.musicBrainzArtistId);
  const tmdbPersonId = claimString(entity.claims, WD.tmdbPersonId);
  const artistName = entity.label?.trim();

  // The authorities are independent — a creator can be a recording artist, a screen credit, and
  // an Apple storefront act all at once (e.g. Bowie) — so resolve the MusicBrainz discography,
  // TMDB filmography, and Apple cover map concurrently. The Apple map is fetched once per
  // creator (a search + a lookup) rather than per album.
  const [albums, credits, itunesCovers] = await Promise.all([
    mbArtistId
      ? fetchMusicBrainzArtistAlbums(mbArtistId, MUSICBRAINZ_ARTIST_ALBUMS_LIMIT)
      : Promise.resolve([] as MusicBrainzReleaseGroup[]),
    tmdbPersonId && hasTmdbCredentials()
      ? fetchTmdbPersonById(tmdbPersonId).then((person) =>
          person ? fetchTmdbPersonCredits(person) : [],
        )
      : Promise.resolve([] as ExternalNodeSearchResult[]),
    mbArtistId && artistName
      ? fetchItunesArtistAlbumCovers(artistName)
      : Promise.resolve(new Map<string, string>()),
  ]);

  // null (not []) means MusicBrainz was unreachable — surface it so the UI distinguishes
  // "couldn't load" from a creator who genuinely has no discography.
  if (albums == null) {
    throw new SubjectWorksUnavailableError("MusicBrainz");
  }

  // Prefer Apple's clean storefront cover by album-title match; Cover Art Archive stands when
  // Apple has no match for that title (so a work never loses its cover, only upgrades it).
  const albumResults = albums.map(releaseGroupToResult).map((result) => {
    const cover = itunesCovers.get(normalizeAlbumTitle(result.snapshot.name));
    return cover ? { ...result, snapshot: { ...result.snapshot, image: cover } } : result;
  });

  return [...albumResults, ...credits];
}

// A short biography for an expanded creator — the English Wikipedia intro extract plus the
// article URL — to fill the panel beside the creator while their (slower) works load. Resolved
// from the exact `enwiki` sitelink of the Wikidata QID, so it can't land on a namesake. Empty
// when the subject isn't a Wikidata entity or has no English article.
export type SearchSubjectBio = {
  extract?: string;
  wikipediaUrl?: string;
};

export async function resolveSearchSubjectBio(
  identity: TreeNodeIdentity,
): Promise<SearchSubjectBio> {
  if (identity.source !== "wikidata") {
    return {};
  }
  const title = await fetchWikidataEnwikiTitle(identity.externalId);
  if (!title) {
    return {};
  }
  const media = await fetchSummaryByTitle(title);
  return { extract: media.wikiExtract, wikipediaUrl: media.wikipediaUrl };
}
