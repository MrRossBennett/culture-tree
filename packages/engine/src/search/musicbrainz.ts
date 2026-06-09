// MusicBrainz is the music authority for search: open data (CC0), no API key, no quota
// wall. The unit of a "studio album" is a *release-group* with
// primary-type "Album" and no secondary types (so live albums/compilations/soundtracks are
// excluded). Cover images come from the Cover Art Archive, keyed by the release-group MBID.
//
// Etiquette: MusicBrainz requires a descriptive User-Agent and rate-limits to ~1 req/s, so
// keep call volume low. There is no popularity signal here — notability ranking arrives
// with the Wikidata-backed entity store (ADR 0004).
const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const COVER_ART_BASE = "https://coverartarchive.org";

function musicBrainzUserAgent(): string {
  return (
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "CultureTree/0.1 (https://culturetree.app; search)"
  );
}

export type MusicBrainzArtist = {
  id: string;
  name: string;
  type?: string;
  disambiguation?: string;
  country?: string;
  // 0–100 text-relevance from the search endpoint (absent on browse).
  score?: number;
};

export type MusicBrainzReleaseGroup = {
  id: string;
  title: string;
  firstReleaseDate?: string;
  primaryType?: string;
  secondaryTypes: string[];
  artistName?: string;
  score?: number;
};

type MusicBrainzArtistRaw = {
  id?: string;
  name?: string;
  type?: string;
  disambiguation?: string;
  country?: string;
  score?: number | string;
};

type MusicBrainzArtistCredit = { name?: string; artist?: { name?: string } };

type MusicBrainzReleaseGroupRaw = {
  id?: string;
  title?: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  score?: number | string;
};

async function musicBrainzFetch(
  resource: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${MUSICBRAINZ_BASE}/${resource}`);
  url.searchParams.set("fmt", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url, { headers: { "User-Agent": musicBrainzUserAgent() } });
    if (!response.ok) {
      console.warn(`[search] MusicBrainz ${resource} failed (HTTP ${response.status}).`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[search] MusicBrainz ${resource} errored.`, error);
    return null;
  }
}

function asScore(value: number | string | undefined): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function mapReleaseGroup(raw: MusicBrainzReleaseGroupRaw): MusicBrainzReleaseGroup | null {
  if (!raw.id || !raw.title) {
    return null;
  }
  const artistName = Array.isArray(raw["artist-credit"])
    ? raw["artist-credit"]
        .map((credit) => credit.name ?? credit.artist?.name)
        .filter((name): name is string => Boolean(name))
        .join(" & ")
    : undefined;
  return {
    id: raw.id,
    title: raw.title,
    firstReleaseDate: raw["first-release-date"],
    primaryType: raw["primary-type"],
    secondaryTypes: raw["secondary-types"] ?? [],
    artistName: artistName || undefined,
    score: asScore(raw.score),
  };
}

// MusicBrainz needs no credentials, so it's always available.
export function hasMusicBrainzAccess(): boolean {
  return true;
}

export async function fetchMusicBrainzArtists(
  query: string,
  limit: number,
): Promise<MusicBrainzArtist[]> {
  const data = (await musicBrainzFetch("artist", { query, limit: String(limit) })) as {
    artists?: MusicBrainzArtistRaw[];
  } | null;
  return (data?.artists ?? [])
    .filter((artist): artist is MusicBrainzArtistRaw & { id: string; name: string } =>
      Boolean(artist.id && artist.name),
    )
    .map((artist) => ({
      id: artist.id,
      name: artist.name,
      type: artist.type,
      disambiguation: artist.disambiguation,
      country: artist.country,
      score: asScore(artist.score),
    }));
}

// MusicBrainz browse caps each response at 100 results and reports the total in
// "release-group-count", so a complete discography is paged. Most artists fit in one page; only
// the prolific (Zappa carries 325 album-type release-groups) spill over.
const MUSICBRAINZ_BROWSE_PAGE_SIZE = 100;
// MusicBrainz rate-limits anonymous traffic to ~1 req/s, so space out the *extra* pages a
// prolific artist needs. The common single-page case pays nothing (the delay precedes pages 2+).
const MUSICBRAINZ_PAGE_DELAY_MS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Studio-album release-groups for an artist: primary-type "Album" with no secondary type
// (drops live albums, compilations, soundtracks, remixes…), ordered oldest-first. Pages the
// browse endpoint until `limit` studio albums are collected or the discography is exhausted —
// the secondary-type filter runs per page, so a page of 100 release-groups can yield far fewer
// studio albums and the next page is fetched to make up the difference.
export async function fetchMusicBrainzArtistAlbums(
  artistMbid: string,
  limit: number,
): Promise<MusicBrainzReleaseGroup[] | null> {
  const studioAlbums: MusicBrainzReleaseGroup[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (studioAlbums.length < limit && offset < total) {
    if (offset > 0) {
      await delay(MUSICBRAINZ_PAGE_DELAY_MS);
    }
    const data = (await musicBrainzFetch("release-group", {
      artist: artistMbid,
      type: "album",
      limit: String(MUSICBRAINZ_BROWSE_PAGE_SIZE),
      offset: String(offset),
    })) as {
      "release-groups"?: MusicBrainzReleaseGroupRaw[];
      "release-group-count"?: number;
    } | null;
    if (data == null) {
      // A page failed (network/503). A partial discography beats none, so surface what we have;
      // only the *first* page failing is a true "couldn't load" (null), distinct from no albums.
      return studioAlbums.length > 0 ? finalizeArtistAlbums(studioAlbums, limit) : null;
    }
    total = data["release-group-count"] ?? total; // total album-type RGs (before the studio filter)
    const page = data["release-groups"] ?? [];
    for (const raw of page) {
      const rg = mapReleaseGroup(raw);
      if (rg && rg.primaryType === "Album" && rg.secondaryTypes.length === 0) {
        studioAlbums.push(rg);
      }
    }
    if (page.length === 0) {
      break; // defensive: no more results even though offset < total
    }
    offset += MUSICBRAINZ_BROWSE_PAGE_SIZE;
  }
  return finalizeArtistAlbums(studioAlbums, limit);
}

// Order oldest-first and apply the cap. (No popularity signal here — see the module header — so
// the cap, which only bites for the rare >limit discography, keeps the earliest releases.)
function finalizeArtistAlbums(
  albums: MusicBrainzReleaseGroup[],
  limit: number,
): MusicBrainzReleaseGroup[] {
  return albums
    .sort((a, b) => (a.firstReleaseDate ?? "").localeCompare(b.firstReleaseDate ?? ""))
    .slice(0, limit);
}

// Title search for the work branch: release-groups matching the query, albums only.
export async function fetchMusicBrainzReleaseGroups(
  query: string,
  limit: number,
): Promise<MusicBrainzReleaseGroup[]> {
  const data = (await musicBrainzFetch("release-group", {
    query,
    limit: String(limit),
  })) as { "release-groups"?: MusicBrainzReleaseGroupRaw[] } | null;
  return (data?.["release-groups"] ?? [])
    .map(mapReleaseGroup)
    .filter((rg): rg is MusicBrainzReleaseGroup => rg != null)
    .filter((rg) => rg.primaryType === "Album");
}

// Cover Art Archive serves fixed-size front-cover derivatives: 250, 500, or 1200 px (plus the
// full-size original at `/front`). 500 matches the app's w500 convention (TMDB posters, Commons
// width=500) and stays crisp on retina where a ~152px card is sampled at 2×; 250 visibly
// upscales. Heavier 1200 isn't worth it for a gallery thumbnail.
type CoverArtSize = 250 | 500 | 1200;

// A stable Cover Art Archive front-cover URL for a release-group. Returns 404 when the
// release-group has no art, so the UI must fall back to a placeholder on image error.
export function coverArtFrontUrl(releaseGroupMbid: string, size: CoverArtSize = 500): string {
  return `${COVER_ART_BASE}/release-group/${encodeURIComponent(releaseGroupMbid)}/front-${size}`;
}
