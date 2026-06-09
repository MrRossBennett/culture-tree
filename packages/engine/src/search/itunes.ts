// Apple's iTunes Search API is the album-art authority for search: free, no API key, no quota
// wall, and — unlike the community-uploaded Cover Art Archive — it only ever serves clean
// commercial storefront art (never a phone photo of the physical disc). It joins by *text*
// (artist + title), not by an id we already hold, so matches are accepted only when the
// normalized artist AND title agree; anything fuzzy is declined so the caller falls back to
// Cover Art Archive. Two shapes: a per-item lookup (one album/song) and a per-artist
// discography map (one lookup yields every album's art, for expanding a creator's works).
//
// Etiquette: no auth, but Apple soft-limits to ~20 calls/min, so the discography map (one
// search + one lookup per creator) is preferred over per-album lookups where a creator is known.
const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";

// The cover size requested from Apple's artwork CDN. 600 matches the app's mid-size convention
// (TMDB w500, Commons width=500) and is crisp on retina; the CDN also serves the original by
// swapping the dimensions, but 600 is the right weight for a gallery thumbnail.
const ARTWORK_SIZE = 600;

// Strip diacritics, punctuation, a leading article, and trailing edition parentheticals
// ("(2012 Remaster)", "[Deluxe Edition]") so a storefront title matches its MusicBrainz/Wikidata
// counterpart. Edition suffixes are dropped because they describe a reissue, not a different
// work — and the artist still has to match, which keeps this safe.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s*[([][^)\]]*[)\]]\s*$/g, " ")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Apple's artwork URLs embed the size ("…/100x100bb.jpg"); swap it for the size we want.
function upsizeArtwork(url: string, size: number = ARTWORK_SIZE): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/i, `/${size}x${size}bb.$1`);
}

type ItunesResult = {
  wrapperType?: string;
  artistId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
};

async function itunesFetch(url: URL): Promise<ItunesResult[] | null> {
  url.searchParams.set("country", "US");
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // 403 = soft rate-limit; any non-OK just means "no art from Apple" → caller falls back.
      console.warn(`[search] iTunes lookup failed (HTTP ${response.status}).`);
      return null;
    }
    const data = (await response.json()) as { results?: ItunesResult[] };
    return data.results ?? [];
  } catch (error) {
    console.warn("[search] iTunes lookup errored.", error);
    return null;
  }
}

// Clean hi-res storefront cover for a single album or song, matched strictly on artist + title.
// undefined when there's no confident match (caller falls back to Cover Art Archive).
export async function fetchItunesCover(
  entity: "album" | "song",
  artist: string | undefined,
  title: string,
  size: number = ARTWORK_SIZE,
): Promise<string | undefined> {
  const term = [artist, title].filter(Boolean).join(" ").trim();
  if (!term) {
    return undefined;
  }
  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set("term", term);
  url.searchParams.set("entity", entity);
  url.searchParams.set("limit", "10");
  const results = await itunesFetch(url);
  if (!results) {
    return undefined;
  }
  const wantTitle = normalize(title);
  const wantArtist = artist ? normalize(artist) : undefined;
  for (const result of results) {
    if (!result.artworkUrl100) {
      continue;
    }
    const candidateTitle = entity === "song" ? result.trackName : result.collectionName;
    if (!candidateTitle || normalize(candidateTitle) !== wantTitle) {
      continue;
    }
    if (wantArtist && result.artistName && normalize(result.artistName) !== wantArtist) {
      continue;
    }
    return upsizeArtwork(result.artworkUrl100, size);
  }
  return undefined;
}

// Every album's storefront art for one artist, keyed by normalized album title, in a single
// search (resolve the artist id) + lookup (their albums). Preferred over per-album calls when
// expanding a creator's whole discography — it's two requests instead of one-per-album. Empty
// map when the artist can't be confidently resolved (caller falls back to Cover Art Archive).
export async function fetchItunesArtistAlbumCovers(
  artist: string,
  size: number = ARTWORK_SIZE,
): Promise<Map<string, string>> {
  const empty = new Map<string, string>();
  const wantArtist = normalize(artist);
  if (!wantArtist) {
    return empty;
  }

  const searchUrl = new URL(ITUNES_SEARCH);
  searchUrl.searchParams.set("term", artist);
  searchUrl.searchParams.set("entity", "musicArtist");
  searchUrl.searchParams.set("limit", "5");
  const artists = await itunesFetch(searchUrl);
  // Strict: only trust an artist whose name matches, so we don't paste another act's covers on.
  const artistId = artists?.find(
    (item) => item.artistId != null && item.artistName && normalize(item.artistName) === wantArtist,
  )?.artistId;
  if (artistId == null) {
    return empty;
  }

  const lookupUrl = new URL(ITUNES_LOOKUP);
  lookupUrl.searchParams.set("id", String(artistId));
  lookupUrl.searchParams.set("entity", "album");
  lookupUrl.searchParams.set("limit", "200");
  const albums = await itunesFetch(lookupUrl);
  if (!albums) {
    return empty;
  }

  const covers = new Map<string, string>();
  for (const album of albums) {
    if (album.collectionName && album.artworkUrl100) {
      covers.set(normalize(album.collectionName), upsizeArtwork(album.artworkUrl100, size));
    }
  }
  return covers;
}

// Exposed for the album-title join in the works panel and for tests.
export function normalizeAlbumTitle(value: string): string {
  return normalize(value);
}
