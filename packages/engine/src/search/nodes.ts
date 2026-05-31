import type {
  ExternalNodeSearchResult,
  NodeTypeValue,
  SearchHint,
  TreeNodeIdentity,
} from "@repo/schemas";

import {
  type MusicBrainzArtist,
  type MusicBrainzReleaseGroup,
  coverArtFrontUrl,
  fetchMusicBrainzArtistAlbums,
  fetchMusicBrainzArtists,
  fetchMusicBrainzReleaseGroups,
} from "./musicbrainz";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
// TEMPORARY "see everything" baseline: fetch a generous set and don't slice the
// final list, so we can observe the full result set before dialing restrictions
// back in. Tighten these (and the CATEGORY_QUOTAS below) once tuned.
const TMDB_CANDIDATE_LIMIT = 20;
// Two-stage creator resolution. A creator's name never appears in their works'
// titles, so a title search for "Scorsese" returns documentaries *about* him, not
// his films. Instead we resolve the dominant person, then fetch their actual
// filmography from /person/{id}/combined_credits (stage two).
const TMDB_PERSON_CANDIDATE_LIMIT = 8;
// How many of a resolved creator's works to surface, ranked by the work's own
// popularity (so the recognisable films lead, not the obscure cameo).
const TMDB_CREDITS_LIMIT = 14;
// TMDB popularity bar a partial-name (e.g. surname-only) person hit must clear to
// be treated as the query's dominant creator. An exact name match bypasses this;
// the bar exists so "blue" doesn't expand into some obscure person's catalogue.
// Tunable against the DEBUG_SEARCH dump.
const CONFIDENT_PERSON_POPULARITY = 6;
// A work by a confidently-resolved creator is the clearest possible intent for a
// creator-name query, so it outscores any incidental title match (a song named
// "Scorsese" ~124, a documentary about him ~114). Works order among themselves by
// their own popularity boost.
const RESOLVED_WORK_BASE = 150;
const GOOGLE_BOOKS_CANDIDATE_LIMIT = 20;
// MusicBrainz candidate limits. Artist search is shallow (we only want the dominant
// match); the album browse pulls a fuller studio discography; the title search feeds the
// work branch.
const MUSICBRAINZ_ARTIST_CANDIDATE_LIMIT = 8;
const MUSICBRAINZ_ARTIST_ALBUMS_LIMIT = 25;
const MUSICBRAINZ_RELEASE_GROUP_SEARCH_LIMIT = 12;
const WIKIPEDIA_CANDIDATE_LIMIT = 15;
const FINAL_RESULT_LIMIT = 200;
// Hop one returns at most this many creator subjects. One artist for "Radiohead",
// but an ambiguous name ("Bowie") may legitimately surface a musician AND an actor,
// so we don't collapse to a single subject.
const MAX_CREATOR_SUBJECT_RESULTS = 3;
// MusicBrainz has no popularity metric, only a 0–100 text-relevance `score`. For a
// non-exact single-token artist hit ("bowie" → "David Bowie") to count as a confident
// subject it must be the top result at this near-perfect relevance — keeping obscure
// same-token artists out without a notability signal (that arrives with the entity store).
const MUSICBRAINZ_CONFIDENT_ARTIST_SCORE = 95;
// Results are grouped by category in this order (artist → album → song → book → film …),
// sorted by score within each group.
const CATEGORY_ORDER: readonly NodeTypeValue[] = [
  "artist",
  "album",
  "song",
  "book",
  "film",
  "tv",
  "person",
  "artwork",
  "podcast",
  "event",
  "place",
];
// Per-type caps for the result blend; types without an entry get DEFAULT_CATEGORY_QUOTA.
const CATEGORY_QUOTAS: Partial<Record<NodeTypeValue, number>> = {
  artist: 2,
  album: 12,
  song: 8,
  book: 6,
  // Generous enough to hold a resolved creator's filmography, not just a few hits.
  film: 14,
  tv: 8,
};
const DEFAULT_CATEGORY_QUOTA = 1;
// Per-category caps are enforced (CATEGORY_QUOTAS above) so each section is bounded
// instead of dumping every candidate. Flip to false to see the full unblended set.
const ENFORCE_CATEGORY_QUOTAS = true;
// Relevance floor: drop results whose score falls below this before blending. Pure
// noise (e.g. "Michael Jackson"/"Queen" surfacing on an "elton john" query) scores
// ~2 because it only shares a token; a real partial hit clears this comfortably.
// Tune against the DEBUG_SEARCH dump.
const RELEVANCE_FLOOR = 20;
const WIKIPEDIA_FETCH_INIT: RequestInit = {
  headers: {
    "User-Agent": "CultureTree/0.1 (local development)",
  },
};

type RankedSearchResult = ExternalNodeSearchResult & { score: number };

type TmdbSearchItem = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  popularity?: number;
};

type TmdbKnownForItem = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
};

type TmdbPersonItem = {
  id?: number;
  name?: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
  known_for?: TmdbKnownForItem[];
};

type TmdbCreditItem = TmdbKnownForItem & {
  job?: string;
  department?: string;
};

type GoogleBooksItem = {
  id?: string;
  volumeInfo?: Record<string, unknown>;
};

type WikipediaSearchItem = {
  title?: string;
  pageid?: number;
  snippet?: string;
};

const SCREEN_NODE_TYPES = new Set<NodeTypeValue>(["film", "tv"]);

// Creators are searchable and used to surface their works, but are not themselves
// addable — only works are. We still run the person/artist lookups (Scorsese → his
// films, an artist → their discography) and then drop the creator records before
// returning. Centralised so the lookup scaffolding stays intact; re-enabling
// creators as addable nodes is a one-line change (empty this set).
const NON_WORK_TYPES = new Set<NodeTypeValue>(["artist", "person"]);

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

export function buildTmdbSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = normalizeText(trimmed);
  const queries = [trimmed];

  // TMDB can miss leading-article titles for short ambiguous queries like "queen".
  if (normalized && !/^(the|a|an)\s/.test(normalized) && normalized.split(" ").length <= 3) {
    queries.push(`the ${trimmed}`);
  }

  return queries;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = value.match(/\b(18|19|20)\d{2}\b/);
  if (!match?.[0]) {
    return undefined;
  }
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : undefined;
}

function pickMetadata(parts: Array<string | undefined>): string | undefined {
  const values = parts.map((part) => part?.trim()).filter(Boolean);
  return values.length > 0 ? values.join(" • ") : undefined;
}

// TMDB's `popularity` is a recency-weighted float (views, votes, watchlist adds…),
// recomputed daily — a far better "which of these is meant" signal than lifetime
// `vote_count`, which over-rewards old, broadly-rated titles. Log-scaled and capped
// so a trending blockbuster can't swamp title-match relevance. Cap/weight tunable.
function tmdbPopularityBoost(popularity: number | undefined): number {
  if (!Number.isFinite(popularity) || popularity == null || popularity <= 0) {
    return 0;
  }

  return Math.min(28, Math.log10(popularity + 1) * 14);
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^(the|a|an)\s+/i, "").trim();
}

// Tribute acts, karaoke records, and cover/mashup bands literally contain the
// query string ("Elton John Experience", "...Tribute Band", "Elton John vs Pnau"),
// so name-match scoring ranks them alongside the real entity. Apply a *penalty*
// (not a hard filter) so they sink below the genuine result without risking the
// removal of a legitimately-named work. Stopgap for Phase 1; music-leaning but
// harmless across sources.
const TRIBUTE_NOISE_PATTERN =
  /\btribute\b|\bkaraoke\b|\bcover band\b|\bexperience\b|\bvs\.?\b|\bversus\b/i;
const TRIBUTE_NOISE_PENALTY = 60;

function tributeNoisePenalty(name: string): number {
  return TRIBUTE_NOISE_PATTERN.test(name) ? TRIBUTE_NOISE_PENALTY : 0;
}

function baseMatchScore(name: string, query: string): number {
  const normalizedName = normalizeText(name);
  const normalizedQuery = normalizeText(query);
  const articleInsensitiveName = normalizeText(stripLeadingArticle(name));
  if (!normalizedName || !normalizedQuery) {
    return 0;
  }
  if (normalizedName === normalizedQuery) {
    return 120;
  }
  if (articleInsensitiveName && articleInsensitiveName === normalizedQuery) {
    return 108;
  }
  let score = 0;
  if (normalizedName.startsWith(normalizedQuery)) {
    score += 90;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 70;
  } else if (articleInsensitiveName.startsWith(normalizedQuery)) {
    score += 84;
  } else if (articleInsensitiveName.includes(normalizedQuery)) {
    score += 66;
  }
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length >= 2);
  const nameTokens = new Set(normalizedName.split(" "));
  const articleInsensitiveTokens = new Set(articleInsensitiveName.split(" ").filter(Boolean));
  for (const token of queryTokens) {
    if (nameTokens.has(token) || articleInsensitiveTokens.has(token)) {
      score += 12;
    }
  }
  return score;
}

function isExactTitleMatch(name: string, query: string): boolean {
  const normalizedName = normalizeText(name);
  const normalizedQuery = normalizeText(query);
  return Boolean(normalizedName && normalizedName === normalizedQuery);
}

function isArticleInsensitiveExactMatch(name: string, query: string): boolean {
  return Boolean(normalizeText(stripLeadingArticle(name)) === normalizeText(query.trim()));
}

// Whether a creator (person/artist) is confidently "the one the query means", so
// we expand their works. Confident = the query is their whole name, OR a single
// distinctive token of it (a surname like "scorsese") backed by enough popularity
// that they're clearly the dominant match. Deliberately conservative: better to
// not expand (and fall back to literal search) than to expand the wrong creator.
export function isConfidentCreatorMatch(
  name: string | undefined,
  query: string,
  popularity: number | undefined,
): boolean {
  if (!name) {
    return false;
  }
  if (isExactTitleMatch(name, query) || isArticleInsensitiveExactMatch(name, query)) {
    return true;
  }
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery || normalizedQuery.includes(" ")) {
    // Multi-word non-exact queries are too ambiguous to treat as a creator name.
    return false;
  }
  const nameTokens = new Set(normalizeText(name).split(" ").filter(Boolean));
  return nameTokens.has(normalizedQuery) && (popularity ?? 0) >= CONFIDENT_PERSON_POPULARITY;
}

// Whether a MusicBrainz artist hit is confidently the creator the query means. MusicBrainz
// has no popularity, so an exact / article-insensitive name match always qualifies; a single
// distinctive token ("bowie" → "David Bowie") qualifies only as the top result at near-
// perfect relevance, keeping obscure same-token artists out. `rank` is the artist's position
// in the (relevance-ordered) MusicBrainz results.
export function isConfidentMusicBrainzArtist(
  name: string | undefined,
  query: string,
  score: number | undefined,
  rank: number,
): boolean {
  if (!name) {
    return false;
  }
  if (isExactTitleMatch(name, query) || isArticleInsensitiveExactMatch(name, query)) {
    return true;
  }
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery || normalizedQuery.includes(" ")) {
    return false;
  }
  const nameTokens = new Set(normalizeText(name).split(" ").filter(Boolean));
  return (
    rank === 0 &&
    nameTokens.has(normalizedQuery) &&
    (score ?? 0) >= MUSICBRAINZ_CONFIDENT_ARTIST_SCORE
  );
}

// The work-branch gate. When the query isn't a creator, a result earns its place only on a
// strong title match, so loose token overlaps can't recreate the old noise. The bar scales
// with query specificity:
//   - single-word queries ("Blue", "Heroes", "Heat") must match a title *exactly* —
//     otherwise "Blue" drags in "Blue Valentine", "Blue Jasmine", etc.
//   - multi-word queries ("lord of the rings", "in rainbows") are specific enough that a
//     prefix or whole-phrase containment is strong (TMDB returns "The Lord of the Rings:
//     The Fellowship of the Ring" for "lord of the rings").
// Conservatively strict; tunable.
export function isStrongWorkTitleMatch(query: string, title: string): boolean {
  if (
    isExactTitleMatch(title, query) ||
    isArticleInsensitiveExactMatch(title, query) ||
    comparableExactMatch(title, query)
  ) {
    return true;
  }
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery || normalizedQuery.split(" ").length < 2) {
    return false;
  }
  const normalizedTitle = normalizeText(title);
  const articleInsensitiveTitle = normalizeText(stripLeadingArticle(title));
  return (
    normalizedTitle.includes(normalizedQuery) || articleInsensitiveTitle.includes(normalizedQuery)
  );
}

function isWikipediaDisambiguation(summary: { description?: string; extract?: string }): boolean {
  const blob = normalizeText(`${summary.description ?? ""} ${summary.extract ?? ""}`);
  return (
    blob === "topics referred to by the same term" ||
    blob === "topics referred to by this term" ||
    blob.includes("topics referred to by the same term") ||
    blob.includes("topics referred to by this term") ||
    blob.includes("may refer to")
  );
}

function exactMatchTypeBoost(type: NodeTypeValue, exactMatch: boolean): number {
  if (!exactMatch) {
    return 0;
  }

  switch (type) {
    case "artist":
      return 28;
    case "album":
      return 18;
    case "song":
      return 14;
    case "book":
      return 12;
    case "person":
      return 10;
    default:
      return 0;
  }
}

function stripTrailingDisambiguator(value: string): string {
  return value.replace(/\s*\([^()]+\)\s*$/i, "").trim();
}

function comparableExactMatch(name: string, query: string): boolean {
  return Boolean(normalizeText(stripTrailingDisambiguator(name)) === normalizeText(query.trim()));
}

function disambiguatedMatchTypeBoost(type: NodeTypeValue, name: string, query: string): number {
  const hasDisambiguator = stripTrailingDisambiguator(name) !== name.trim();
  if (!hasDisambiguator || !comparableExactMatch(name, query)) {
    return 0;
  }

  switch (type) {
    case "artist":
      return 36;
    case "album":
      return 20;
    case "song":
      return 16;
    case "book":
      return 14;
    case "person":
      return 12;
    default:
      return 0;
  }
}

function httpsify(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

function isLikelyGoogleBooksPlaceholderUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "books.google.com" &&
      parsed.pathname.includes("/books/content") &&
      !parsed.searchParams.has("edge") &&
      !parsed.searchParams.has("imgtk")
    );
  } catch {
    return false;
  }
}

function volumeDisplayTitle(volumeInfo: Record<string, unknown>): string {
  const title = typeof volumeInfo.title === "string" ? volumeInfo.title.trim() : "";
  const subtitle = typeof volumeInfo.subtitle === "string" ? volumeInfo.subtitle.trim() : "";
  if (title && subtitle) {
    return `${title}: ${subtitle}`;
  }
  return title;
}

function googleBooksEditionUrl(
  volumeId: string | undefined,
  infoLink: string | undefined,
): string | undefined {
  const id = volumeId?.trim();
  if (id) {
    return `https://books.google.com/books?id=${encodeURIComponent(id)}&hl=en`;
  }
  return httpsify(infoLink);
}

function normalizedWikipediaKey(title: string): string {
  return title.trim().replace(/\s+/g, "_");
}

function normalizeComparableTitle(value: string): string {
  return normalizeText(
    value.replace(/\s*\((film|tv series|television series|miniseries|soundtrack)\)\s*$/i, ""),
  );
}

function inferredScreenType(result: ExternalNodeSearchResult): "film" | "tv" | null {
  if (result.snapshot.type === "film" || result.snapshot.type === "tv") {
    return result.snapshot.type;
  }

  const blob = `${result.snapshot.name} ${result.meta ?? ""} ${result.externalUrl ?? ""}`;
  const normalized = normalizeText(blob);

  if (
    normalized.includes(" tv series ") ||
    normalized.includes(" television series ") ||
    normalized.includes(" miniseries ") ||
    normalized.includes("/tv/")
  ) {
    return "tv";
  }

  if (normalized.includes(" film ") || normalized.includes("/movie/")) {
    return "film";
  }

  return null;
}

function isSameCreativeWork(
  left: ExternalNodeSearchResult,
  right: ExternalNodeSearchResult,
): boolean {
  const leftScreenType = inferredScreenType(left);
  const rightScreenType = inferredScreenType(right);
  if (!leftScreenType || leftScreenType !== rightScreenType) {
    return false;
  }

  if (
    SCREEN_NODE_TYPES.has(left.snapshot.type) ||
    SCREEN_NODE_TYPES.has(right.snapshot.type) ||
    left.identity.source === "wikipedia" ||
    right.identity.source === "wikipedia"
  ) {
    const leftName = normalizeComparableTitle(left.snapshot.name);
    const rightName = normalizeComparableTitle(right.snapshot.name);
    if (!leftName || leftName !== rightName) {
      return false;
    }
  } else {
    return false;
  }

  const leftYear = left.snapshot.year;
  const rightYear = right.snapshot.year;
  if (leftYear != null && rightYear != null && leftYear !== rightYear) {
    return false;
  }

  return true;
}

function sourcePriority(result: ExternalNodeSearchResult): number {
  switch (result.identity.source) {
    case "tmdb":
      return 3;
    case "musicbrainz":
      return 3;
    case "google-books":
      return 2;
    case "wikipedia":
      return 1;
  }
}

function scoreOf(result: ExternalNodeSearchResult): number {
  const score = (result as RankedSearchResult).score;
  return typeof score === "number" ? score : 0;
}

function compareByScore(left: RankedSearchResult, right: RankedSearchResult): number {
  return right.score - left.score;
}

function normalizeEntityName(name: string): string {
  return normalizeText(stripTrailingDisambiguator(name));
}

function sameCreator(left: ExternalNodeSearchResult, right: ExternalNodeSearchResult): boolean {
  const leftCreator = left.searchHint.creator?.trim();
  const rightCreator = right.searchHint.creator?.trim();
  // A missing creator on either side can't disprove a match, so defer to name+year.
  if (!leftCreator || !rightCreator) {
    return true;
  }
  return normalizeText(leftCreator) === normalizeText(rightCreator);
}

function isSameMusicEntity(
  left: ExternalNodeSearchResult,
  right: ExternalNodeSearchResult,
): boolean {
  const type = left.snapshot.type;
  if (type !== right.snapshot.type || (type !== "artist" && type !== "album")) {
    return false;
  }
  const leftName = normalizeEntityName(left.snapshot.name);
  const rightName = normalizeEntityName(right.snapshot.name);
  if (!leftName || leftName !== rightName) {
    return false;
  }
  if (type === "artist") {
    return true;
  }
  if (!sameCreator(left, right)) {
    return false;
  }
  const leftYear = left.snapshot.year;
  const rightYear = right.snapshot.year;
  return !(leftYear != null && rightYear != null && leftYear !== rightYear);
}

function isSamePerson(left: ExternalNodeSearchResult, right: ExternalNodeSearchResult): boolean {
  if (left.snapshot.type !== "person" || right.snapshot.type !== "person") {
    return false;
  }
  const leftName = normalizeEntityName(left.snapshot.name);
  const rightName = normalizeEntityName(right.snapshot.name);
  return Boolean(leftName && leftName === rightName);
}

function isSameSearchEntity(
  left: ExternalNodeSearchResult,
  right: ExternalNodeSearchResult,
): boolean {
  return (
    isSameCreativeWork(left, right) || isSameMusicEntity(left, right) || isSamePerson(left, right)
  );
}

function mergeArtistDuplicate<T extends ExternalNodeSearchResult>(existing: T, incoming: T): T {
  // Prefer the Wikipedia record for description/links, but keep whichever image
  // exists when only one side has one.
  const wiki =
    existing.identity.source === "wikipedia"
      ? existing
      : incoming.identity.source === "wikipedia"
        ? incoming
        : existing;
  const other = wiki === existing ? incoming : existing;
  const merged = {
    ...wiki,
    snapshot: { ...wiki.snapshot, image: wiki.snapshot.image ?? other.snapshot.image },
    meta: wiki.meta ?? other.meta,
  } as T;
  if (typeof (merged as RankedSearchResult).score === "number") {
    (merged as RankedSearchResult).score = Math.max(scoreOf(existing), scoreOf(incoming));
  }
  return merged;
}

export function dedupeExternalSearchResults<T extends ExternalNodeSearchResult>(
  results: readonly T[],
): T[] {
  const deduped: T[] = [];

  for (const result of results) {
    const existingIndex = deduped.findIndex((candidate) => isSameSearchEntity(candidate, result));
    if (existingIndex === -1) {
      deduped.push(result);
      continue;
    }

    const existing = deduped[existingIndex];
    if (result.snapshot.type === "artist" && existing.snapshot.type === "artist") {
      deduped[existingIndex] = mergeArtistDuplicate(existing, result);
      continue;
    }
    if (sourcePriority(result) > sourcePriority(existing)) {
      deduped[existingIndex] = result;
    }
  }

  return deduped;
}

/**
 * Groups results by category in CATEGORY_ORDER (artist → album → song → book →
 * film …), sorted by score within each group. When quotas are enforced each group
 * is capped per CATEGORY_QUOTAS; otherwise every result in the group is kept (up to
 * the overall limit). Deliberately simple: predictable category sections, no
 * cross-category score interleaving.
 */
export function blendByCategoryQuota(
  results: readonly RankedSearchResult[],
  limit: number,
  options: { enforceQuotas?: boolean } = {},
): RankedSearchResult[] {
  const enforceQuotas = options.enforceQuotas ?? ENFORCE_CATEGORY_QUOTAS;

  const byType = new Map<NodeTypeValue, RankedSearchResult[]>();
  for (const result of results) {
    const bucket = byType.get(result.snapshot.type);
    if (bucket) {
      bucket.push(result);
    } else {
      byType.set(result.snapshot.type, [result]);
    }
  }

  // Known categories first in display order, then any stragglers not in CATEGORY_ORDER.
  const orderedTypes: NodeTypeValue[] = [
    ...CATEGORY_ORDER,
    ...[...byType.keys()].filter((type) => !CATEGORY_ORDER.includes(type)),
  ];

  const blended: RankedSearchResult[] = [];
  for (const type of orderedTypes) {
    if (blended.length >= limit) {
      break;
    }
    const bucket = byType.get(type);
    if (!bucket) {
      continue;
    }
    // Sort by score within each section. Score folds in each source's best relevance/
    // popularity signal (TMDB popularity, MusicBrainz relevance, Google Books
    // ratingsCount), so a single uniform sort gives a relevance-aware ordering.
    bucket.sort(compareByScore);
    const cap = enforceQuotas ? (CATEGORY_QUOTAS[type] ?? DEFAULT_CATEGORY_QUOTA) : bucket.length;
    for (const result of bucket.slice(0, cap)) {
      if (blended.length >= limit) {
        break;
      }
      blended.push(result);
    }
  }

  return blended;
}

/**
 * When the query exactly names an artist (e.g. "Elton John"), secondary fuzzy
 * artist hits — "Elton John and Tim Rice", tribute acts — are noise; the user
 * clearly means the named artist. Drop non-exact artists, but only when an exact
 * one is actually present, so ambiguous queries still surface their alternatives.
 * Artist-only: other categories (multiple films/albums) are left untouched.
 */
export function collapseArtistsToExactMatch(
  results: readonly RankedSearchResult[],
  query: string,
): RankedSearchResult[] {
  const isExactArtist = (result: RankedSearchResult) =>
    result.snapshot.type === "artist" &&
    (isExactTitleMatch(result.snapshot.name, query) ||
      isArticleInsensitiveExactMatch(result.snapshot.name, query));
  if (!results.some(isExactArtist)) {
    return [...results];
  }
  return results.filter((result) => result.snapshot.type !== "artist" || isExactArtist(result));
}

function creatorFromWikipediaDescription(description: string | undefined): string | undefined {
  if (!description) {
    return undefined;
  }
  const match = description.match(/\bby\s+([^,.()]+)/i);
  return match?.[1]?.trim();
}

// Index/list pages ("Elton John albums discography", "List of songs recorded by…",
// "Elton John videography") describe their subject as a singer/film/etc., so
// inferWikipediaType happily mistypes them as real entities. Filter them out.
const WIKIPEDIA_NON_ENTITY_TITLE_PATTERN =
  /\b(discography|videography|filmography|bibliography)\b|\blist of\b/i;

function isNonEntityWikipediaTitle(title: string): boolean {
  return WIKIPEDIA_NON_ENTITY_TITLE_PATTERN.test(title);
}

function isWikipediaListSummary(description: string | undefined): boolean {
  return normalizeText(description ?? "").includes("wikimedia list");
}

function inferWikipediaType(blob: string): NodeTypeValue | null {
  const normalized = normalizeText(blob);
  if (!normalized) {
    return null;
  }
  if (normalized.includes(" video game ")) {
    return null;
  }
  // "American film director", "filmmaker", "film producer" describe a *person* but
  // contain " film " — match the creative role before the medium so directors and
  // screenwriters aren't mistyped as films.
  if (
    normalized.includes(" film director") ||
    normalized.includes(" filmmaker") ||
    normalized.includes(" film producer") ||
    normalized.includes(" screenwriter")
  ) {
    return "person";
  }
  if (normalized.includes(" film ")) {
    return "film";
  }
  if (
    normalized.includes(" tv series ") ||
    normalized.includes(" television series ") ||
    normalized.includes(" miniseries ")
  ) {
    return "tv";
  }
  if (
    normalized.includes(" book ") ||
    normalized.includes(" novel ") ||
    normalized.includes(" novella ") ||
    normalized.includes(" memoir ") ||
    normalized.includes(" non fiction ") ||
    normalized.includes(" short story collection ")
  ) {
    return "book";
  }
  if (normalized.includes(" album ")) return "album";
  if (normalized.includes(" song ")) return "song";
  if (
    normalized.includes(" band ") ||
    normalized.includes(" duo ") ||
    normalized.includes(" musician ") ||
    normalized.includes(" singer ") ||
    normalized.includes(" rapper ") ||
    normalized.includes(" composer ") ||
    normalized.includes(" dj ") ||
    normalized.includes(" musical group ")
  ) {
    return "artist";
  }
  if (
    normalized.includes(" author ") ||
    normalized.includes(" writer ") ||
    normalized.includes(" poet ") ||
    normalized.includes(" actor ") ||
    normalized.includes(" actress ") ||
    normalized.includes(" director ") ||
    normalized.includes(" journalist ") ||
    normalized.includes(" philosopher ") ||
    normalized.includes(" politician ") ||
    normalized.includes(" historian ")
  ) {
    return "person";
  }
  if (
    normalized.includes(" painting ") ||
    normalized.includes(" sculpture ") ||
    normalized.includes(" artwork ") ||
    normalized.includes(" mural ") ||
    normalized.includes(" installation art ")
  ) {
    return "artwork";
  }
  return null;
}

export function normalizeTmdbSearchResult(
  item: TmdbSearchItem,
  mediaType: "movie" | "tv",
  query: string,
  rank: number,
): RankedSearchResult | null {
  if (item.id == null) {
    return null;
  }
  const name = (mediaType === "movie" ? item.title : item.name)?.trim();
  if (!name) {
    return null;
  }
  const year = parseYear(mediaType === "movie" ? item.release_date : item.first_air_date);
  const image = item.poster_path ? `${TMDB_IMG}/w185${item.poster_path}` : undefined;
  const exactMatch = isExactTitleMatch(name, query);
  const articleInsensitiveExactMatch = isArticleInsensitiveExactMatch(name, query);
  const score =
    baseMatchScore(name, query) +
    (year != null ? 8 : 0) +
    (image ? 4 : 0) +
    tmdbPopularityBoost(item.popularity) +
    (articleInsensitiveExactMatch && !exactMatch ? 10 : 0) +
    (exactMatch ? -8 : 0) -
    tributeNoisePenalty(name) -
    rank * 2;
  return {
    kind: "addable-work",
    identity: {
      source: "tmdb",
      externalId: `${mediaType}:${item.id}`,
    },
    snapshot: {
      name,
      type: mediaType === "movie" ? "film" : "tv",
      year,
      image,
    },
    searchHint: {
      title: name,
    },
    meta: pickMetadata([year != null ? String(year) : undefined]),
    externalUrl: `https://www.themoviedb.org/${mediaType}/${item.id}`,
    score,
  };
}

function tmdbPersonRole(department: string | undefined): string | undefined {
  switch (department) {
    case "Directing":
      return "Director";
    case "Acting":
      return "Actor";
    case "Writing":
      return "Writer";
    case "Production":
      return "Producer";
    default:
      return department?.trim() || undefined;
  }
}

export function normalizeTmdbPersonResult(
  item: TmdbPersonItem,
  query: string,
  rank: number,
): RankedSearchResult | null {
  if (item.id == null) {
    return null;
  }
  const name = item.name?.trim();
  if (!name) {
    return null;
  }
  const image = item.profile_path ? `${TMDB_IMG}/w185${item.profile_path}` : undefined;
  const exactMatch = isExactTitleMatch(name, query);
  const score =
    baseMatchScore(name, query) +
    tmdbPopularityBoost(item.popularity) +
    exactMatchTypeBoost("person", exactMatch) +
    (image ? 4 : 0) -
    tributeNoisePenalty(name) -
    rank * 2;
  return {
    kind: "expandable-subject",
    identity: {
      source: "tmdb",
      externalId: `person:${item.id}`,
    },
    snapshot: {
      name,
      type: "person",
      image,
    },
    searchHint: {
      title: name,
    },
    meta: pickMetadata([tmdbPersonRole(item.known_for_department)]),
    externalUrl: `https://www.themoviedb.org/person/${item.id}`,
    score,
  };
}

// A work fetched from a confidently-resolved creator's credits (stage two). It
// never contains the query string in its title, so it can't earn a title-match
// score — but it IS the answer to a creator query, so it's scored as a resolved
// work (above incidental title matches) and ordered by its own popularity. The
// creator is carried through as the work's credit.
export function normalizeTmdbCreditResult(
  item: TmdbCreditItem,
  creator: string | undefined,
  rank: number,
): RankedSearchResult | null {
  const mediaType = item.media_type;
  if (item.id == null || (mediaType !== "movie" && mediaType !== "tv")) {
    return null;
  }
  const name = (mediaType === "movie" ? item.title : item.name)?.trim();
  if (!name) {
    return null;
  }
  const year = parseYear(mediaType === "movie" ? item.release_date : item.first_air_date);
  const image = item.poster_path ? `${TMDB_IMG}/w185${item.poster_path}` : undefined;
  const score = RESOLVED_WORK_BASE + tmdbPopularityBoost(item.popularity) - rank;
  return {
    kind: "addable-work",
    identity: {
      source: "tmdb",
      externalId: `${mediaType}:${item.id}`,
    },
    snapshot: {
      name,
      type: mediaType === "movie" ? "film" : "tv",
      year,
      image,
    },
    searchHint: {
      title: name,
      creator: creator?.trim() || undefined,
    },
    meta: pickMetadata([creator?.trim(), year != null ? String(year) : undefined]),
    externalUrl: `https://www.themoviedb.org/${mediaType}/${item.id}`,
    score,
  };
}

// Google Books has no popularity float, but `ratingsCount` is a usable proxy: it's
// present on the well-known canonical edition and absent on the long tail of
// reprints, so boosting by it pulls the recognizable edition to the top. Log-scaled
// and capped in line with the other source boosts. Tunable.
function googleBooksRatingsBoost(ratingsCount: unknown): number {
  if (typeof ratingsCount !== "number" || !Number.isFinite(ratingsCount) || ratingsCount <= 0) {
    return 0;
  }
  return Math.min(20, Math.log10(ratingsCount + 1) * 9);
}

export function normalizeGoogleBooksSearchResult(
  item: GoogleBooksItem,
  query: string,
  rank: number,
): RankedSearchResult | null {
  const volumeInfo = item.volumeInfo;
  if (!item.id || !volumeInfo) {
    return null;
  }
  const name = volumeDisplayTitle(volumeInfo);
  if (!name) {
    return null;
  }
  const authors = Array.isArray(volumeInfo.authors)
    ? volumeInfo.authors
        .map((author) => (typeof author === "string" ? author.trim() : ""))
        .filter(Boolean)
    : [];
  const year = parseYear(volumeInfo.publishedDate);
  const imageLinks =
    volumeInfo.imageLinks && typeof volumeInfo.imageLinks === "object"
      ? (volumeInfo.imageLinks as Record<string, unknown>)
      : undefined;
  const rawImage = httpsify(
    typeof imageLinks?.thumbnail === "string"
      ? imageLinks.thumbnail
      : typeof imageLinks?.smallThumbnail === "string"
        ? imageLinks.smallThumbnail
        : undefined,
  );
  const image = isLikelyGoogleBooksPlaceholderUrl(rawImage) ? undefined : rawImage;
  const infoLink = typeof volumeInfo.infoLink === "string" ? volumeInfo.infoLink : undefined;
  const score =
    baseMatchScore(name, query) +
    (authors.length > 0 ? 10 : 0) +
    (year != null ? 8 : 0) +
    (image ? 4 : 0) +
    googleBooksRatingsBoost(volumeInfo.ratingsCount) -
    tributeNoisePenalty(name) -
    rank * 2;

  return {
    kind: "addable-work",
    identity: {
      source: "google-books",
      externalId: item.id,
    },
    snapshot: {
      name,
      type: "book",
      year,
      image,
    },
    searchHint: {
      title: name,
      creator: authors[0],
    },
    meta: pickMetadata([authors[0], year != null ? String(year) : undefined]),
    externalUrl: googleBooksEditionUrl(item.id, infoLink),
    score,
  };
}

export function normalizeWikipediaSearchResult(input: {
  search: WikipediaSearchItem;
  summary: {
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
  query: string;
  rank: number;
}): RankedSearchResult | null {
  const title = input.search.title?.trim();
  if (!title) {
    return null;
  }
  if (isNonEntityWikipediaTitle(title) || isWikipediaListSummary(input.summary.description)) {
    return null;
  }
  if (isWikipediaDisambiguation(input.summary)) {
    return null;
  }
  const blob = [input.summary.description, input.summary.extract, input.search.snippet]
    .filter(Boolean)
    .join(" ");
  const type = inferWikipediaType(blob);
  if (!type) {
    return null;
  }
  const year = parseYear(blob);
  const image = input.summary.thumbnail?.source ?? input.summary.originalimage?.source;
  const normalizedKey = normalizedWikipediaKey(title);
  const exactMatch = isExactTitleMatch(title, input.query);
  const score =
    baseMatchScore(title, input.query) +
    (input.summary.description ? 10 : 0) +
    (year != null ? 6 : 0) +
    exactMatchTypeBoost(type, exactMatch) +
    disambiguatedMatchTypeBoost(type, title, input.query) +
    (image ? 4 : 0) -
    tributeNoisePenalty(title) -
    input.rank * 2;
  const creator =
    type === "album" || type === "song" || type === "book" || type === "artwork"
      ? creatorFromWikipediaDescription(input.summary.description)
      : undefined;

  const searchHint: SearchHint = {
    title,
    wikiSlug: normalizedKey,
  };
  if (creator) {
    searchHint.creator = creator;
  }

  return {
    kind: "addable-work",
    identity: {
      source: "wikipedia",
      externalId: normalizedKey,
    },
    snapshot: {
      name: title,
      type,
      year,
      image,
    },
    searchHint,
    meta: input.summary.description?.trim() || undefined,
    externalUrl: input.summary.content_urls?.desktop?.page,
    score,
  };
}

// Title search only — the work branch of hop one. Creator resolution (person →
// filmography) is no longer eager here; it's hop two (resolveSearchSubjectWorks).
async function searchTmdb(query: string): Promise<RankedSearchResult[]> {
  if (!hasTmdbCredentials()) {
    return [];
  }

  async function fetchList(
    mediaType: "movie" | "tv",
    tmdbQuery: string,
  ): Promise<RankedSearchResult[]> {
    const url = new URL(`${TMDB_BASE}/search/${mediaType}`);
    url.searchParams.set("query", tmdbQuery);
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { results?: TmdbSearchItem[] };
    return (data.results ?? [])
      .slice(0, TMDB_CANDIDATE_LIMIT)
      .map((item, index) => normalizeTmdbSearchResult(item, mediaType, query, index))
      .filter((item): item is RankedSearchResult => item != null);
  }

  const tmdbQueries = buildTmdbSearchQueries(query);
  const settled = await Promise.all(
    tmdbQueries.flatMap((tmdbQuery) => [fetchList("movie", tmdbQuery), fetchList("tv", tmdbQuery)]),
  );

  const deduped = new Map<string, RankedSearchResult>();
  for (const result of settled.flat()) {
    const key = `${result.identity.source}:${result.identity.externalId}`;
    const existing = deduped.get(key);
    if (!existing || result.score > existing.score) {
      deduped.set(key, result);
    }
  }

  return Array.from(deduped.values());
}

// Confident TMDB people for the query, ranked by popularity — the subject-classification
// input. TMDB returns people ranked by relevance/popularity; we keep those whose name the
// query confidently names (whole name, or a distinctive token backed by popularity).
async function fetchTmdbConfidentPersons(query: string): Promise<TmdbPersonItem[]> {
  if (!hasTmdbCredentials()) {
    return [];
  }
  const url = new URL(`${TMDB_BASE}/search/person`);
  url.searchParams.set("query", query);
  const response = await fetch(url, tmdbFetchInit(url));
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { results?: TmdbPersonItem[] };
  return (data.results ?? [])
    .slice(0, TMDB_PERSON_CANDIDATE_LIMIT)
    .filter((person) => isConfidentCreatorMatch(person.name, query, person.popularity))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

// Hop two: resolve a TMDB person id to their filmography. Re-fetches the person detail
// for `known_for_department` (hop one only carried the id through `identity`), then their
// credits — directed films first for directors, otherwise their acting roles.
async function fetchTmdbPersonById(personId: string): Promise<TmdbPersonItem | null> {
  if (!hasTmdbCredentials()) {
    return null;
  }
  const url = new URL(`${TMDB_BASE}/person/${personId}`);
  const response = await fetch(url, tmdbFetchInit(url));
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as TmdbPersonItem;
}

// A creator's filmography, ranked by the work's own popularity. Phase 1 is movies only
// (no TV). Credits are picked by what the person is known for: directors/writers/producers
// are credited in `crew` under their department; actors in `cast`. This keeps "Scorsese"
// on his directed films, not his higher-popularity talk-show cameos.
async function fetchTmdbPersonCredits(person: TmdbPersonItem): Promise<RankedSearchResult[]> {
  if (person.id == null || !hasTmdbCredentials()) {
    return [];
  }
  const url = new URL(`${TMDB_BASE}/person/${person.id}/combined_credits`);
  const response = await fetch(url, tmdbFetchInit(url));
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { cast?: TmdbCreditItem[]; crew?: TmdbCreditItem[] };
  const primaryDept = person.known_for_department;
  const chosen =
    primaryDept && primaryDept !== "Acting"
      ? (data.crew ?? []).filter((credit) => credit.department === primaryDept)
      : (data.cast ?? []);
  const pool = chosen.length > 0 ? chosen : [...(data.cast ?? []), ...(data.crew ?? [])];
  const byId = new Map<string, TmdbCreditItem>();
  for (const credit of pool) {
    // Phase 1: movies only; TV credits are out of scope for expansion.
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
    .map((credit, index) => normalizeTmdbCreditResult(credit, person.name, index))
    .filter((item): item is RankedSearchResult => item != null);
}

async function searchGoogleBooks(query: string): Promise<RankedSearchResult[]> {
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(GOOGLE_BOOKS_CANDIDATE_LIMIT));
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (key) {
    url.searchParams.set("key", key);
  } else {
    console.warn(
      "[search] GOOGLE_BOOKS_API_KEY is not set; book results are likely to be rate-limited (HTTP 429).",
    );
  }
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(
      `[search] Google Books request failed (HTTP ${response.status}); returning no book results.`,
    );
    return [];
  }
  const data = (await response.json()) as { items?: GoogleBooksItem[] };
  return (data.items ?? [])
    .slice(0, GOOGLE_BOOKS_CANDIDATE_LIMIT)
    .map((item, index) => normalizeGoogleBooksSearchResult(item, query, index))
    .filter((item): item is RankedSearchResult => item != null);
}

// MusicBrainz has no popularity, only a 0–100 text-relevance `score`. Use it as a mild
// tie-breaker (capped, in line with the other source boosts) so the strongest match leads.
function musicBrainzScoreBoost(score: number | undefined): number {
  if (!Number.isFinite(score) || score == null || score <= 0) {
    return 0;
  }
  return Math.min(20, (score / 100) * 20);
}

export function normalizeMusicBrainzArtist(
  item: MusicBrainzArtist,
  query: string,
  rank: number,
): RankedSearchResult | null {
  const name = item.name?.trim();
  if (!item.id || !name) {
    return null;
  }
  const exactMatch = isExactTitleMatch(name, query);
  const score =
    baseMatchScore(name, query) +
    musicBrainzScoreBoost(item.score) +
    exactMatchTypeBoost("artist", exactMatch) -
    tributeNoisePenalty(name) -
    rank * 2;

  return {
    kind: "expandable-subject",
    // Artist subjects are never added, so the `artist:` prefix is safe — only
    // resolveSearchSubjectWorks reads it. (Album works below use the bare MBID, which is
    // what the entity resolver expects for a committed node.)
    identity: { source: "musicbrainz", externalId: `artist:${item.id}` },
    snapshot: { name, type: "artist" },
    searchHint: { title: name },
    meta: pickMetadata([item.disambiguation, item.country]),
    externalUrl: `https://musicbrainz.org/artist/${item.id}`,
    score,
  };
}

export function normalizeMusicBrainzReleaseGroup(
  item: MusicBrainzReleaseGroup,
  query: string,
  rank: number,
  options: { resolvedWork?: boolean } = {},
): RankedSearchResult | null {
  const name = item.title?.trim();
  if (!item.id || !name) {
    return null;
  }
  const creator = item.artistName?.trim();
  const year = parseYear(item.firstReleaseDate);
  // Cover Art Archive front cover, keyed by release-group MBID. 404s when there's no art,
  // so the UI must fall back to a placeholder on image error.
  const image = coverArtFrontUrl(item.id);
  // An album from a confidently-resolved artist's discography (hop two) is a resolved work;
  // otherwise a title-search hit carries the title-match score.
  const resolvedWork = options.resolvedWork || isConfidentCreatorMatch(creator, query, undefined);
  const matchScore = resolvedWork ? RESOLVED_WORK_BASE : baseMatchScore(name, query);
  const score =
    matchScore +
    musicBrainzScoreBoost(item.score) +
    (year != null ? 6 : 0) -
    tributeNoisePenalty(name) -
    rank * 2;

  return {
    kind: "addable-work",
    // Bare release-group MBID — the convention the entity resolver expects for an album.
    identity: { source: "musicbrainz", externalId: item.id },
    snapshot: { name, type: "album", year, image },
    searchHint: { title: name, creator },
    meta: pickMetadata([creator, year != null ? String(year) : undefined]),
    externalUrl: `https://musicbrainz.org/release-group/${item.id}`,
    score,
  };
}

// Album title search — the work branch. Artist discography is hop two
// (resolveSearchSubjectWorks); creator classification runs its own artist search via
// fetchMusicBrainzArtistSubjects.
async function searchMusicBrainz(query: string): Promise<RankedSearchResult[]> {
  const releaseGroups = await fetchMusicBrainzReleaseGroups(
    query,
    MUSICBRAINZ_RELEASE_GROUP_SEARCH_LIMIT,
  );
  return releaseGroups
    .map((item, index) => normalizeMusicBrainzReleaseGroup(item, query, index))
    .filter((item): item is RankedSearchResult => item != null);
}

// Confident MusicBrainz artist subjects for the query (see isConfidentMusicBrainzArtist):
// exact name match, or the top relevance hit on a distinctive token.
async function fetchMusicBrainzArtistSubjects(query: string): Promise<RankedSearchResult[]> {
  const artists = await fetchMusicBrainzArtists(query, MUSICBRAINZ_ARTIST_CANDIDATE_LIMIT);
  return artists
    .filter((item, index) => isConfidentMusicBrainzArtist(item.name, query, item.score, index))
    .map((item, index) => normalizeMusicBrainzArtist(item, query, index))
    .filter((item): item is RankedSearchResult => item != null);
}

async function fetchWikipediaSummary(title: string) {
  const path = encodeURIComponent(title.replaceAll(" ", "_"));
  const response = await fetch(`${WIKI_REST}/page/summary/${path}`, WIKIPEDIA_FETCH_INIT);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as {
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
}

async function searchWikipedia(query: string): Promise<RankedSearchResult[]> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", String(WIKIPEDIA_CANDIDATE_LIMIT));
  url.searchParams.set("srsearch", query);

  const response = await fetch(url, WIKIPEDIA_FETCH_INIT);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    query?: { search?: WikipediaSearchItem[] };
  };
  // Drop index/list pages before the per-result summary fetch — fewer round-trips
  // and they'd be discarded by normalizeWikipediaSearchResult anyway.
  const candidates =
    data.query?.search
      ?.filter((candidate) => candidate.title && !isNonEntityWikipediaTitle(candidate.title))
      .slice(0, WIKIPEDIA_CANDIDATE_LIMIT) ?? [];
  const summaries = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      summary: candidate.title ? await fetchWikipediaSummary(candidate.title) : null,
    })),
  );

  return summaries
    .map(({ candidate, summary }, index) => {
      if (!summary) {
        return null;
      }
      return normalizeWikipediaSearchResult({
        search: candidate,
        summary,
        query,
        rank: index,
      });
    })
    .filter((item): item is RankedSearchResult => item != null);
}

// Flip to false (or unset the env var) to silence the per-search result dump.
const DEBUG_SEARCH = process.env.DEBUG_SEARCH !== "0";

function logSearchResults(
  query: string,
  perSource: Record<string, PromiseSettledResult<RankedSearchResult[]>>,
  blended: RankedSearchResult[],
): void {
  if (!DEBUG_SEARCH) {
    return;
  }

  const fmt = (r: RankedSearchResult) =>
    `${r.snapshot.type.padEnd(7)} ${r.score.toFixed(0).padStart(4)}  ${r.snapshot.name}` +
    `${r.searchHint.creator ? ` — ${r.searchHint.creator}` : ""}` +
    `${r.snapshot.year ? ` (${r.snapshot.year})` : ""}`;

  console.log(`\n[search] query="${query}"`);
  for (const [source, settled] of Object.entries(perSource)) {
    if (settled.status === "rejected") {
      console.log(`  ${source}: ERROR`, settled.reason);
      continue;
    }
    const sorted = [...settled.value].sort((l, r) => r.score - l.score);
    console.log(`  ${source}: ${sorted.length} result(s)`);
    for (const r of sorted) {
      console.log(`    ${fmt(r)}`);
    }
  }

  console.log(`  FINAL (blended, ${blended.length}):`);
  for (const r of blended) {
    console.log(`    ${fmt(r)}  [${r.identity.source}]`);
  }
  console.log("");
}

function logSearchSubjects(query: string, subjects: RankedSearchResult[]): void {
  if (!DEBUG_SEARCH) {
    return;
  }
  console.log(`\n[search] query="${query}" → CREATOR branch (${subjects.length} subject(s)):`);
  for (const r of subjects) {
    console.log(
      `    ${r.snapshot.type.padEnd(7)} ${r.score.toFixed(0).padStart(4)}  ${r.snapshot.name}  [${r.identity.source}]`,
    );
  }
  console.log("");
}

// The additive type only Wikipedia produces and the primary sources can't:
// artworks. When the authoritative sources found usable results, Wikipedia is
// restricted to this — its film/tv/book/music entries are dropped as weak
// duplicates and mistypes. (People are produced by Wikipedia too, but creators
// aren't addable, so they're filtered out downstream via NON_WORK_TYPES.)
const WIKIPEDIA_SUPPLEMENTARY_TYPES = new Set<NodeTypeValue>(["artwork"]);

export function filterWikipediaFallbackResults(
  wikipediaResults: readonly RankedSearchResult[],
  options: { hasUsablePrimaryResult: boolean },
): RankedSearchResult[] {
  // No usable primary results — Wikipedia stands in fully as the backup source.
  if (!options.hasUsablePrimaryResult) {
    return [...wikipediaResults];
  }
  return wikipediaResults.filter((result) =>
    WIKIPEDIA_SUPPLEMENTARY_TYPES.has(result.snapshot.type),
  );
}

function stripScore(result: RankedSearchResult): ExternalNodeSearchResult {
  const { score: _score, ...rest } = result;
  return rest;
}

// Hop one, classification. Confident creator subjects for the query — MusicBrainz artists
// and TMDB people, each scored by their normaliser. Both facets are kept for ambiguous names
// (a musician AND an actor named the same); only the total is capped. Empty result =>
// "not a creator query", so the caller runs the work branch instead.
async function resolveCreatorSubjects(query: string): Promise<RankedSearchResult[]> {
  const [artistSubjects, persons] = await Promise.all([
    fetchMusicBrainzArtistSubjects(query),
    fetchTmdbConfidentPersons(query),
  ]);
  const personSubjects = persons
    .map((person, index) => normalizeTmdbPersonResult(person, query, index))
    .filter((item): item is RankedSearchResult => item != null);
  return [...artistSubjects, ...personSubjects]
    .sort(compareByScore)
    .slice(0, MAX_CREATOR_SUBJECT_RESULTS);
}

// MusicBrainz release-groups are already deduped to the canonical album, but the occasional
// deluxe/remaster release-group slips through; strip the trailing variant marker so the
// catalogue shows one entry per album.
function stripAlbumVariantName(name: string): string {
  return stripTrailingDisambiguator(name)
    .replace(
      /\s*[-–—:]\s*(deluxe|remaster(ed)?|expanded|anniversary|special|collector'?s|bonus|mono|stereo|live|reissue|legacy|super deluxe)\b.*$/i,
      "",
    )
    .trim();
}

// Collapse album variants within a single artist's catalogue by their stripped name,
// keeping the highest-scoring pressing (score folds in popularity).
function dedupeAlbumVariants(results: readonly RankedSearchResult[]): RankedSearchResult[] {
  const byName = new Map<string, RankedSearchResult>();
  for (const result of results) {
    const key = normalizeText(stripAlbumVariantName(result.snapshot.name));
    const existing = byName.get(key);
    if (!existing || result.score > existing.score) {
      byName.set(key, result);
    }
  }
  return Array.from(byName.values());
}

// Thrown when the authoritative source can't be reached (rate-limited, network, auth) —
// distinct from a creator who genuinely has no resolvable works. Lets the UI show "couldn't
// load, try again" instead of a misleading "no works found".
export class SubjectWorksUnavailableError extends Error {
  constructor(source: string) {
    super(`Could not load works from ${source}.`);
    this.name = "SubjectWorksUnavailableError";
  }
}

// Hop two. Resolve a creator subject's `identity` to their works from the one authoritative
// source: a MusicBrainz artist → studio albums; a TMDB person → filmography (movies, Phase 1).
// ID-scoped, so structurally free of the keyword-blend noise the old flat search produced.
export async function resolveSearchSubjectWorks(
  identity: TreeNodeIdentity,
): Promise<ExternalNodeSearchResult[]> {
  const { source, externalId } = identity;

  if (source === "musicbrainz" && externalId.startsWith("artist:")) {
    const artistMbid = externalId.slice("artist:".length);
    const releaseGroups = await fetchMusicBrainzArtistAlbums(
      artistMbid,
      MUSICBRAINZ_ARTIST_ALBUMS_LIMIT,
    );
    // null = the browse failed (network/503); [] = artist has no studio albums.
    if (releaseGroups == null) {
      throw new SubjectWorksUnavailableError("MusicBrainz");
    }
    const albums = releaseGroups
      .map((item, index) =>
        normalizeMusicBrainzReleaseGroup(item, "", index, { resolvedWork: true }),
      )
      .filter((item): item is RankedSearchResult => item != null);
    return dedupeAlbumVariants(albums).sort(compareByScore).map(stripScore);
  }

  if (source === "tmdb" && externalId.startsWith("person:")) {
    const person = await fetchTmdbPersonById(externalId.slice("person:".length));
    if (!person) {
      throw new SubjectWorksUnavailableError("TMDB");
    }
    const credits = await fetchTmdbPersonCredits(person);
    return credits.sort(compareByScore).map(stripScore);
  }

  return [];
}

type WorkSearchOutcome = {
  works: RankedSearchResult[];
  perSource: Record<string, PromiseSettledResult<RankedSearchResult[]>>;
};

// Title search for works across the sources, gated hard by isStrongWorkTitleMatch so loose
// token overlaps don't leak ("Blue" must not drag in "Blue Valentine").
async function searchWorks(trimmed: string): Promise<WorkSearchOutcome> {
  const [tmdb, googleBooks, musicbrainz, wikipedia] = await Promise.allSettled([
    searchTmdb(trimmed),
    searchGoogleBooks(trimmed),
    searchMusicBrainz(trimmed),
    searchWikipedia(trimmed),
  ]);

  const fulfilled = (result: PromiseSettledResult<RankedSearchResult[]>) =>
    result.status === "fulfilled" ? result.value : [];

  // TMDB, Google Books, and MusicBrainz are the authoritative sources. Wikipedia is a
  // fallback: when the primary sources surface anything usable it contributes only the types
  // they structurally can't produce (artworks); otherwise it stands in as the full backup.
  const primaryResults = [...fulfilled(tmdb), ...fulfilled(googleBooks), ...fulfilled(musicbrainz)];
  const hasUsablePrimaryResult = primaryResults.some((result) => result.score >= RELEVANCE_FLOOR);
  const wikipediaResults = filterWikipediaFallbackResults(fulfilled(wikipedia), {
    hasUsablePrimaryResult,
  });

  const rankedResults = [...primaryResults, ...wikipediaResults]
    .filter((result) => !NON_WORK_TYPES.has(result.snapshot.type))
    .filter((result) => isStrongWorkTitleMatch(trimmed, result.snapshot.name))
    .sort((left, right) => right.score - left.score);

  const deduped = dedupeExternalSearchResults(rankedResults);
  // Relevance floor: drop sub-threshold noise before blending. Dedupe first so a merged
  // artist (which keeps the higher of two scores) isn't cut on its weaker half.
  const aboveFloor = deduped.filter((result) => result.score >= RELEVANCE_FLOOR);
  const focused = collapseArtistsToExactMatch(aboveFloor, trimmed);
  const works = blendByCategoryQuota(focused, FINAL_RESULT_LIMIT).sort(compareByScore);

  return { works, perSource: { tmdb, googleBooks, musicbrainz, wikipedia } };
}

export async function searchExternalNodes(query: string): Promise<ExternalNodeSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  // Surface BOTH interpretations rather than destructively classifying: works the query
  // could name (addable) AND creators it could name (expandable). Suppressing one branch
  // when the other matches is how "Rubber Soul" returned an obscure band instead of the
  // Beatles album. Works lead — a work-title query has a matching work while a creator-name
  // query usually doesn't (titles don't contain the creator's name), so the artist/person
  // naturally shows when there's no competing work. True notability ranking comes with the
  // entity store (ADR 0004); this is the interim, non-destructive ordering.
  const [subjects, { works, perSource }] = await Promise.all([
    resolveCreatorSubjects(trimmed),
    searchWorks(trimmed),
  ]);

  const orderedWorks = works.sort(compareByScore);
  const orderedSubjects = subjects.sort(compareByScore);

  logSearchResults(trimmed, perSource, orderedWorks);
  if (orderedSubjects.length > 0) {
    logSearchSubjects(trimmed, orderedSubjects);
  }

  return [...orderedWorks, ...orderedSubjects].map(stripScore);
}
