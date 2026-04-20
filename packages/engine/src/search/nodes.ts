import type { ExternalNodeSearchResult, NodeTypeValue, SearchHint } from "@repo/schemas";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

type RankedSearchResult = ExternalNodeSearchResult & { score: number };

type TmdbSearchItem = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
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

function baseMatchScore(name: string, query: string): number {
  const normalizedName = normalizeText(name);
  const normalizedQuery = normalizeText(query);
  if (!normalizedName || !normalizedQuery) {
    return 0;
  }
  if (normalizedName === normalizedQuery) {
    return 120;
  }
  let score = 0;
  if (normalizedName.startsWith(normalizedQuery)) {
    score += 90;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 70;
  }
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length >= 2);
  const nameTokens = new Set(normalizedName.split(" "));
  for (const token of queryTokens) {
    if (nameTokens.has(token)) {
      score += 12;
    }
  }
  return score;
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
    return "publication";
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
  const score = baseMatchScore(name, query) + (year != null ? 8 : 0) + (image ? 4 : 0) - rank * 2;
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
  const score =
    baseMatchScore(title, input.query) +
    (input.summary.description ? 10 : 0) +
    (year != null ? 6 : 0) +
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

  async function fetchList(mediaType: "movie" | "tv"): Promise<RankedSearchResult[]> {
    const url = new URL(`${TMDB_BASE}/search/${mediaType}`);
    url.searchParams.set("query", query);
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { results?: TmdbSearchItem[] };
    return (data.results ?? [])
      .slice(0, 5)
      .map((item, index) => normalizeTmdbSearchResult(item, mediaType, query, index))
      .filter((item): item is RankedSearchResult => item != null);
  }

  const [movies, shows] = await Promise.all([fetchList("movie"), fetchList("tv")]);
  return [...movies, ...shows];
}

async function searchGoogleBooks(query: string): Promise<RankedSearchResult[]> {
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "6");
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
    .slice(0, 6)
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
  url.searchParams.set("srlimit", "8");
  url.searchParams.set("srsearch", query);

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    query?: { search?: WikipediaSearchItem[] };
  };
  const candidates = data.query?.search?.slice(0, 8) ?? [];
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

  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map(({ score: _score, ...result }) => result);
}
