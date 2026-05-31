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

// Studio-album release-groups for an artist: primary-type "Album" with no secondary type
// (drops live albums, compilations, soundtracks, remixes…), ordered oldest-first.
export async function fetchMusicBrainzArtistAlbums(
  artistMbid: string,
  limit: number,
): Promise<MusicBrainzReleaseGroup[] | null> {
  const data = (await musicBrainzFetch("release-group", {
    artist: artistMbid,
    type: "album",
    limit: String(limit),
  })) as { "release-groups"?: MusicBrainzReleaseGroupRaw[] } | null;
  // null = the browse failed (network/503); distinct from an artist with no albums.
  if (data == null) {
    return null;
  }
  return (data["release-groups"] ?? [])
    .map(mapReleaseGroup)
    .filter((rg): rg is MusicBrainzReleaseGroup => rg != null)
    .filter((rg) => rg.primaryType === "Album" && rg.secondaryTypes.length === 0)
    .sort((a, b) => (a.firstReleaseDate ?? "").localeCompare(b.firstReleaseDate ?? ""));
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

// A stable Cover Art Archive front-cover URL for a release-group. Returns 404 when the
// release-group has no art, so the UI must fall back to a placeholder on image error.
export function coverArtFrontUrl(releaseGroupMbid: string): string {
  return `${COVER_ART_BASE}/release-group/${encodeURIComponent(releaseGroupMbid)}/front-250`;
}
