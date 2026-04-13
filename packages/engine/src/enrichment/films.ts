import type { EnrichedMedia, TreeNode } from "@repo/schemas";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

/**
 * TMDB settings page has two different values:
 * - **API Read Access Token** (JWT) → `TMDB_ACCESS_TOKEN` + `Authorization: Bearer …`
 * - **API Key** (v3) → `TMDB_API_KEY` + `?api_key=…` on each request
 * Using the API Key as Bearer (or vice versa) yields `status_code` 7.
 */
function hasTmdbCredentials(): boolean {
  return Boolean(process.env.TMDB_ACCESS_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim());
}

/** Mutates `url` when using API key. */
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

type TmdbErrorBody = { success?: boolean; status_code?: number; status_message?: string };

function isTmdbErrorJson(data: unknown): data is TmdbErrorBody {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const o = data as TmdbErrorBody;
  return o.success === false && typeof o.status_code === "number";
}

/**
 * Models often put release year in `searchHint.title` (`… — 1968`). TMDB expects a
 * clean title + separate `year` / `first_air_date_year` param.
 */
function parseTmdbTitleAndYear(
  rawTitle: string,
  nodeYear: number | undefined,
): { title: string; year: number | undefined } {
  let title = rawTitle.trim();
  let year = nodeYear;

  const tailYear = title.match(/(?:\s*[—–-]\s*|\s*\(\s*)((?:19|20)\d{2})\s*\)?\s*$/u);
  if (tailYear?.[1]) {
    title = title.slice(0, tailYear.index).trim();
    if (year == null) {
      year = Number.parseInt(tailYear[1], 10);
    }
  }

  title = title.replace(/\s*[—–]\s*$/u, "").trim();
  title = title.replace(/\s+/g, " ").trim();

  return { title, year };
}

type TmdbVideo = { type?: string; site?: string; key?: string };

function pickTrailer(videos: unknown): TmdbVideo | undefined {
  if (!Array.isArray(videos)) {
    return undefined;
  }
  return videos.find(
    (v): v is TmdbVideo =>
      typeof v === "object" &&
      v != null &&
      (v as TmdbVideo).type === "Trailer" &&
      (v as TmdbVideo).site === "YouTube" &&
      typeof (v as TmdbVideo).key === "string",
  );
}

export async function fetchFilmEnrichment(node: TreeNode): Promise<EnrichedMedia> {
  if (!hasTmdbCredentials()) {
    return {};
  }
  const { title: rawTitle } = node.searchHint;
  const { title, year } = parseTmdbTitleAndYear(rawTitle, node.year);
  const url = new URL(`${TMDB_BASE}/search/movie`);
  url.searchParams.set("query", title);
  if (year != null) {
    url.searchParams.set("year", String(year));
  }

  const searchRes = await fetch(url, tmdbFetchInit(url));
  if (!searchRes.ok) {
    return {};
  }
  const searchData = (await searchRes.json()) as
    | TmdbErrorBody
    | { results?: Array<{ id?: number; poster_path?: string | null; overview?: string }> };
  if (isTmdbErrorJson(searchData)) {
    return {};
  }
  const film = searchData.results?.[0];
  if (film?.id == null) {
    return {};
  }

  const detailUrl = new URL(`${TMDB_BASE}/movie/${film.id}`);
  detailUrl.searchParams.set("append_to_response", "videos");
  const detailRes = await fetch(detailUrl, tmdbFetchInit(detailUrl));
  if (!detailRes.ok) {
    return {};
  }
  const detail = (await detailRes.json()) as
    | TmdbErrorBody
    | {
        poster_path?: string | null;
        overview?: string;
        vote_average?: number;
        videos?: { results?: unknown };
      };
  if (isTmdbErrorJson(detail)) {
    return {};
  }
  const trailer = pickTrailer(detail.videos?.results);

  const poster = detail.poster_path ?? film.poster_path;
  return {
    coverUrl: poster ? `${TMDB_IMG}/w500${poster}` : undefined,
    thumbnailUrl: poster ? `${TMDB_IMG}/w185${poster}` : undefined,
    externalUrl: `https://www.themoviedb.org/movie/${film.id}`,
    youtubeVideoId: trailer?.key,
    youtubeUrl: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    rating: typeof detail.vote_average === "number" ? detail.vote_average : undefined,
    description:
      typeof detail.overview === "string"
        ? detail.overview.slice(0, 500)
        : typeof film.overview === "string"
          ? film.overview.slice(0, 500)
          : undefined,
    externalId: String(film.id),
  };
}

export async function fetchTvEnrichment(node: TreeNode): Promise<EnrichedMedia> {
  if (!hasTmdbCredentials()) {
    return {};
  }
  const { title: rawTitle } = node.searchHint;
  const { title, year } = parseTmdbTitleAndYear(rawTitle, node.year);
  const url = new URL(`${TMDB_BASE}/search/tv`);
  url.searchParams.set("query", title);
  if (year != null) {
    url.searchParams.set("first_air_date_year", String(year));
  }

  const searchRes = await fetch(url, tmdbFetchInit(url));
  if (!searchRes.ok) {
    return {};
  }
  const searchData = (await searchRes.json()) as
    | TmdbErrorBody
    | { results?: Array<{ id?: number; poster_path?: string | null; overview?: string }> };
  if (isTmdbErrorJson(searchData)) {
    return {};
  }
  const show = searchData.results?.[0];
  if (show?.id == null) {
    return {};
  }

  const detailUrl = new URL(`${TMDB_BASE}/tv/${show.id}`);
  detailUrl.searchParams.set("append_to_response", "videos");
  const detailRes = await fetch(detailUrl, tmdbFetchInit(detailUrl));
  if (!detailRes.ok) {
    return {};
  }
  const detail = (await detailRes.json()) as
    | TmdbErrorBody
    | {
        poster_path?: string | null;
        overview?: string;
        vote_average?: number;
        videos?: { results?: unknown };
      };
  if (isTmdbErrorJson(detail)) {
    return {};
  }
  const trailer = pickTrailer(detail.videos?.results);

  const poster = detail.poster_path ?? show.poster_path;
  return {
    coverUrl: poster ? `${TMDB_IMG}/w500${poster}` : undefined,
    thumbnailUrl: poster ? `${TMDB_IMG}/w185${poster}` : undefined,
    externalUrl: `https://www.themoviedb.org/tv/${show.id}`,
    youtubeVideoId: trailer?.key,
    youtubeUrl: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    rating: typeof detail.vote_average === "number" ? detail.vote_average : undefined,
    description:
      typeof detail.overview === "string"
        ? detail.overview.slice(0, 500)
        : typeof show.overview === "string"
          ? show.overview.slice(0, 500)
          : undefined,
    externalId: String(show.id),
  };
}
