const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
const SPOTIFY_ARTISTS_URL = "https://api.spotify.com/v1/artists";
// Refresh a little before the token actually lapses so an in-flight search never
// races the expiry boundary.
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export type SpotifyImage = { url?: string; height?: number; width?: number };

type SpotifyArtistRef = { id?: string; name?: string };

export type SpotifyArtistItem = {
  id?: string;
  name?: string;
  images?: SpotifyImage[];
  popularity?: number;
  genres?: string[];
  external_urls?: { spotify?: string };
};

export type SpotifyAlbumItem = {
  id?: string;
  name?: string;
  album_type?: string;
  release_date?: string;
  images?: SpotifyImage[];
  popularity?: number;
  artists?: SpotifyArtistRef[];
  external_urls?: { spotify?: string };
};

export type SpotifyTrackItem = {
  id?: string;
  name?: string;
  popularity?: number;
  album?: SpotifyAlbumItem;
  artists?: SpotifyArtistRef[];
  external_urls?: { spotify?: string };
};

export type SpotifySearchResponse = {
  artists?: { items?: SpotifyArtistItem[] };
  albums?: { items?: SpotifyAlbumItem[] };
  tracks?: { items?: SpotifyTrackItem[] };
};

export type SpotifySearchType = "artist" | "album" | "track";

type CachedToken = { value: string; expiresAt: number };

// Module-scoped token cache. A single shared in-flight promise prevents concurrent
// searches from stampeding the token endpoint when the cache is cold or expired.
let cachedToken: CachedToken | null = null;
let inFlightToken: Promise<string | null> | null = null;
let warnedMissingCredentials = false;

export function hasSpotifyCredentials(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim(),
  );
}

function spotifyBasicAuthHeader(): string | null {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim();
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    return null;
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function requestToken(): Promise<string | null> {
  const authHeader = spotifyBasicAuthHeader();
  if (!authHeader) {
    return null;
  }

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      console.warn(`[search] Spotify token request failed (HTTP ${response.status}).`);
      return null;
    }
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      return null;
    }
    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + expiresInMs };
    return cachedToken.value;
  } catch (error) {
    console.warn("[search] Spotify token request errored.", error);
    return null;
  }
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!hasSpotifyCredentials()) {
    if (!warnedMissingCredentials) {
      console.warn(
        "[search] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set; skipping music search.",
      );
      warnedMissingCredentials = true;
    }
    return null;
  }

  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_EXPIRY_SKEW_MS) {
    return cachedToken.value;
  }

  if (forceRefresh) {
    cachedToken = null;
  }

  if (!inFlightToken) {
    inFlightToken = requestToken().finally(() => {
      inFlightToken = null;
    });
  }
  return inFlightToken;
}

async function fetchSearchWithToken(
  token: string,
  query: string,
  types: readonly SpotifySearchType[],
  limit: number,
): Promise<Response> {
  const url = new URL(SPOTIFY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("type", types.join(","));
  url.searchParams.set("limit", String(limit));
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export async function fetchSpotifySearch(
  query: string,
  options: { types: readonly SpotifySearchType[]; limit: number },
): Promise<SpotifySearchResponse | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  try {
    let response = await fetchSearchWithToken(token, query, options.types, options.limit);
    // A 401 means the cached token lapsed mid-window; refresh once and retry.
    if (response.status === 401) {
      const refreshed = await getAccessToken(true);
      if (!refreshed) {
        return null;
      }
      response = await fetchSearchWithToken(refreshed, query, options.types, options.limit);
    }
    if (!response.ok) {
      console.warn(`[search] Spotify search failed (HTTP ${response.status}).`);
      return null;
    }
    return (await response.json()) as SpotifySearchResponse;
  } catch (error) {
    console.warn("[search] Spotify search errored.", error);
    return null;
  }
}

function fetchArtistAlbumsPage(
  token: string,
  artistId: string,
  limit: number,
  offset: number,
): Promise<Response> {
  const url = new URL(`${SPOTIFY_ARTISTS_URL}/${artistId}/albums`);
  url.searchParams.set("include_groups", "album");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * Fetches an artist's studio-album discography. Pages are requested in parallel
 * (the search-relevance album list is shallow; this fills in the back catalogue).
 * `limit` is per page and capped by the same quota as search (10 for this app).
 */
export async function fetchSpotifyArtistAlbums(
  artistId: string,
  options: { limit: number; pages: number },
): Promise<SpotifyAlbumItem[] | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  const offsets = Array.from({ length: options.pages }, (_, page) => page * options.limit);

  try {
    let responses = await Promise.all(
      offsets.map((offset) => fetchArtistAlbumsPage(token, artistId, options.limit, offset)),
    );
    // A 401 on any page means the cached token lapsed; refresh once and retry all.
    if (responses.some((response) => response.status === 401)) {
      const refreshed = await getAccessToken(true);
      if (!refreshed) {
        return null;
      }
      responses = await Promise.all(
        offsets.map((offset) => fetchArtistAlbumsPage(refreshed, artistId, options.limit, offset)),
      );
    }

    const items: SpotifyAlbumItem[] = [];
    for (const response of responses) {
      if (!response.ok) {
        // A short discography just returns fewer pages; only warn on the first page.
        if (response !== responses[0]) {
          continue;
        }
        console.warn(`[search] Spotify artist albums failed (HTTP ${response.status}).`);
        continue;
      }
      const data = (await response.json()) as { items?: SpotifyAlbumItem[] };
      if (data.items) {
        items.push(...data.items);
      }
    }
    return items;
  } catch (error) {
    console.warn("[search] Spotify artist albums errored.", error);
    return null;
  }
}
