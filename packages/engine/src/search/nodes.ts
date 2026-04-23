import type { ExternalNodeSearchResult, NodeTypeValue, SearchHint } from "@repo/schemas";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const TMDB_CANDIDATE_LIMIT = 20;
const GOOGLE_BOOKS_CANDIDATE_LIMIT = 6;
const WIKIPEDIA_CANDIDATE_LIMIT = 8;
const FINAL_RESULT_LIMIT = 12;
const DIVERSIFIED_HEAD_LIMIT = 3;
const DIVERSIFIED_TYPE_ORDER: readonly NodeTypeValue[] = [
  "artist",
  "album",
  "song",
  "book",
  "film",
  "tv",
  "person",
  "article",
  "artwork",
  "podcast",
  "event",
  "place",
];

type RankedSearchResult = ExternalNodeSearchResult & { score: number };

type TmdbSearchItem = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_count?: number;
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

function tmdbVoteCountBoost(voteCount: number | undefined): number {
  if (!Number.isFinite(voteCount) || voteCount == null || voteCount <= 0) {
    return 0;
  }

  return Math.min(24, Math.log10(voteCount + 1) * 8);
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^(the|a|an)\s+/i, "").trim();
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

function isComparableExactTitleMatch(name: string, query: string): boolean {
  return Boolean(normalizeText(stripTrailingDisambiguator(name)) === normalizeText(query.trim()));
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
    case "google-books":
      return 2;
    case "wikipedia":
      return 1;
  }
}

export function dedupeExternalSearchResults(
  results: ExternalNodeSearchResult[],
): ExternalNodeSearchResult[] {
  const deduped: ExternalNodeSearchResult[] = [];

  for (const result of results) {
    const existingIndex = deduped.findIndex((candidate) => isSameCreativeWork(candidate, result));
    if (existingIndex === -1) {
      deduped.push(result);
      continue;
    }

    if (sourcePriority(result) > sourcePriority(deduped[existingIndex])) {
      deduped[existingIndex] = result;
    }
  }

  return deduped;
}

function isStrongHeadMatch(result: ExternalNodeSearchResult, query: string): boolean {
  return (
    isExactTitleMatch(result.snapshot.name, query) ||
    isArticleInsensitiveExactMatch(result.snapshot.name, query) ||
    isComparableExactTitleMatch(result.snapshot.name, query)
  );
}

export function diversifySearchResults(
  results: ExternalNodeSearchResult[],
  query: string,
): ExternalNodeSearchResult[] {
  const strongMatches = results.filter((result) => isStrongHeadMatch(result, query));
  if (strongMatches.length <= 1) {
    return results;
  }

  const selected = new Set<string>();
  const head: ExternalNodeSearchResult[] = [];

  for (const type of DIVERSIFIED_TYPE_ORDER) {
    const match = strongMatches.find(
      (result) =>
        result.snapshot.type === type &&
        !selected.has(`${result.identity.source}:${result.identity.externalId}`),
    );
    if (!match) {
      continue;
    }

    head.push(match);
    selected.add(`${match.identity.source}:${match.identity.externalId}`);
    if (head.length >= DIVERSIFIED_HEAD_LIMIT) {
      break;
    }
  }

  if (head.length === 0) {
    return results;
  }

  return [
    ...head,
    ...results.filter(
      (result) => !selected.has(`${result.identity.source}:${result.identity.externalId}`),
    ),
  ];
}

function creatorFromWikipediaDescription(description: string | undefined): string | undefined {
  if (!description) {
    return undefined;
  }
  const match = description.match(/\bby\s+([^,.()]+)/i);
  return match?.[1]?.trim();
}

function inferWikipediaType(blob: string): NodeTypeValue | null {
  const normalized = normalizeText(blob);
  if (!normalized) {
    return null;
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
    normalized.includes(" magazine ") ||
    normalized.includes(" newspaper ") ||
    normalized.includes(" journal ") ||
    normalized.includes(" zine ")
  ) {
    return "article";
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
  if (normalized.includes(" essay ") || normalized.includes(" article ")) {
    return "article";
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
    tmdbVoteCountBoost(item.vote_count) +
    (articleInsensitiveExactMatch && !exactMatch ? 10 : 0) +
    (exactMatch ? -8 : 0) -
    rank * 2;
  return {
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
  const image = httpsify(
    typeof imageLinks?.thumbnail === "string"
      ? imageLinks.thumbnail
      : typeof imageLinks?.smallThumbnail === "string"
        ? imageLinks.smallThumbnail
        : undefined,
  );
  const infoLink = typeof volumeInfo.infoLink === "string" ? volumeInfo.infoLink : undefined;
  const score =
    baseMatchScore(name, query) +
    (authors.length > 0 ? 10 : 0) +
    (year != null ? 8 : 0) +
    (image ? 4 : 0) -
    rank * 2;

  return {
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
    input.rank * 2;
  const creator =
    type === "album" || type === "song" || type === "artwork"
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

async function searchGoogleBooks(query: string): Promise<RankedSearchResult[]> {
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(GOOGLE_BOOKS_CANDIDATE_LIMIT));
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (key) {
    url.searchParams.set("key", key);
  }
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { items?: GoogleBooksItem[] };
  return (data.items ?? [])
    .slice(0, GOOGLE_BOOKS_CANDIDATE_LIMIT)
    .map((item, index) => normalizeGoogleBooksSearchResult(item, query, index))
    .filter((item): item is RankedSearchResult => item != null);
}

async function fetchWikipediaSummary(title: string) {
  const path = encodeURIComponent(title.replaceAll(" ", "_"));
  const response = await fetch(`${WIKI_REST}/page/summary/${path}`);
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

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    query?: { search?: WikipediaSearchItem[] };
  };
  const candidates = data.query?.search?.slice(0, WIKIPEDIA_CANDIDATE_LIMIT) ?? [];
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

export async function searchExternalNodes(query: string): Promise<ExternalNodeSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const settled = await Promise.allSettled([
    searchTmdb(trimmed),
    searchGoogleBooks(trimmed),
    searchWikipedia(trimmed),
  ]);

  const rankedResults = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => right.score - left.score)
    .map(({ score: _score, ...result }) => result);

  return diversifySearchResults(dedupeExternalSearchResults(rankedResults), trimmed).slice(
    0,
    FINAL_RESULT_LIMIT,
  );
}
