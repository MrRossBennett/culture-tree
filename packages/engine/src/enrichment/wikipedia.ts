import type { EnrichedMedia, TreeItem } from "@repo/schemas";

const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

function stripTrailingAuthorFromTitle(title: string): string {
  const trimmed = title.trim();
  const stripped = trimmed.replace(/\s*[—–]\s*[^—–]+$/u, "").trim();
  return stripped.length >= 3 ? stripped : trimmed;
}

async function fetchSummaryByTitle(pageTitle: string): Promise<EnrichedMedia> {
  const path = encodeURIComponent(pageTitle.replaceAll(" ", "_"));
  const res = await fetch(`${WIKI_REST}/page/summary/${path}`);
  if (!res.ok) {
    return {};
  }
  const data = (await res.json()) as {
    content_urls?: { desktop?: { page?: string } };
    extract?: string;
    description?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    coordinates?: { lat?: number; lon?: number };
  };
  return {
    wikipediaUrl: data.content_urls?.desktop?.page,
    wikiExtract: typeof data.extract === "string" ? data.extract.slice(0, 500) : undefined,
    description: data.description,
    thumbnailUrl: data.thumbnail?.source,
    coverUrl: data.originalimage?.source,
    externalUrl: data.content_urls?.desktop?.page,
    coordinates:
      typeof data.coordinates?.lat === "number" && typeof data.coordinates.lon === "number"
        ? { lat: data.coordinates.lat, lng: data.coordinates.lon }
        : undefined,
  };
}

async function searchTitle(query: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("srsearch", query);

  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    query?: { search?: Array<{ title?: string }> };
  };
  const title = data.query?.search?.[0]?.title;
  return title ?? null;
}

export async function wikipediaFromSearchQuery(searchQuery: string): Promise<EnrichedMedia> {
  const title = await searchTitle(searchQuery);
  if (!title) {
    return {};
  }
  return fetchSummaryByTitle(title);
}

function hasWikipediaImage(media: EnrichedMedia): boolean {
  return Boolean(media.thumbnailUrl?.trim() || media.coverUrl?.trim());
}

const FINE_ART_TOPIC_HINTS = [
  "oil on canvas",
  "oil painting",
  "french painter",
  "painting by",
  "tempera",
  "watercolor",
  "watercolour",
  "fresco",
  "national gallery",
  "metropolitan museum of art",
  "the louvre",
  "louvre",
  "musée d",
  "musée du louvre",
  "sculpture by",
  "easel",
  "hung in the",
  "canvas,",
  "édouard manet",
  "edouard manet",
] as const;

function normalizeWikiText(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
}

function wikipediaBlobLooksLikeFineArt(blob: string): boolean {
  return FINE_ART_TOPIC_HINTS.some((h) => blob.includes(h));
}

/** Require that the track title (or a long token from it) appears in article text — avoids "Suicide" matching Manet's *Le Suicidé*. */
function trackTitleAppearsPlausible(blob: string, trackTitle: string): boolean {
  const t = normalizeWikiText(trackTitle);
  if (t.length >= 5 && blob.includes(t)) {
    return true;
  }
  const words = t.split(" ").filter((w) => w.length >= 4);
  if (words.length > 0) {
    return words.some((w) => blob.includes(w));
  }
  const shortWords = t.split(" ").filter((w) => w.length >= 2);
  return shortWords.some((w) => blob.includes(w));
}

function isBadSongWikipediaMatch(media: EnrichedMedia, trackTitle: string): boolean {
  const blob = normalizeWikiText(
    `${media.wikiExtract ?? ""} ${media.description ?? ""} ${media.wikipediaUrl ?? ""}`,
  );
  if (!blob.trim()) {
    return true;
  }
  if (wikipediaBlobLooksLikeFineArt(blob)) {
    return true;
  }
  if (!trackTitleAppearsPlausible(blob, trackTitle)) {
    return true;
  }
  return false;
}

async function wikipediaArtistImageForMusic(creator: string): Promise<EnrichedMedia> {
  const queries = [`${creator} band`, `${creator} musical group`, creator];
  for (const q of queries) {
    const m = await wikipediaFromSearchQuery(q);
    const blob = normalizeWikiText(`${m.wikiExtract ?? ""} ${m.description ?? ""}`);
    if (wikipediaBlobLooksLikeFineArt(blob)) {
      continue;
    }
    if (hasWikipediaImage(m)) {
      return m;
    }
  }
  return {};
}

async function mergeSongWithArtistImageIfNeeded(
  song: EnrichedMedia,
  creator: string | undefined,
): Promise<EnrichedMedia> {
  if (!creator?.trim() || hasWikipediaImage(song)) {
    return song;
  }
  const artist = await wikipediaArtistImageForMusic(creator.trim());
  if (!hasWikipediaImage(artist)) {
    return song;
  }
  return {
    ...song,
    thumbnailUrl: song.thumbnailUrl ?? artist.thumbnailUrl,
    coverUrl: song.coverUrl ?? artist.coverUrl,
  };
}

export async function fetchWikipediaEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  if (slug) {
    return fetchSummaryByTitle(slug);
  }
  const q =
    [item.searchHint.title, item.searchHint.creator?.trim()].filter(Boolean).join(" ") || item.name;
  return wikipediaFromSearchQuery(q);
}

function placeSearchQuery(item: TreeItem): string {
  const location = item.searchHint.location;
  return [
    item.searchHint.title?.trim() || item.name,
    location?.address?.trim(),
    location?.city?.trim(),
    location?.country?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Place nodes: Wikipedia first for phase 1 images/context; Google Places can layer on photos/maps later. */
export async function fetchWikipediaPlaceEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  if (slug) {
    return fetchSummaryByTitle(slug);
  }
  return wikipediaFromSearchQuery(placeSearchQuery(item));
}

function eventSearchQuery(item: TreeItem): string {
  return [
    item.searchHint.title?.trim() || item.name,
    item.searchHint.dateRange?.start?.trim(),
    item.searchHint.location?.city?.trim(),
    item.searchHint.location?.country?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Event nodes: Wikipedia summaries usually provide the best phase-1 canonical page and lead image. */
export async function fetchWikipediaEventEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  const media = slug
    ? await fetchSummaryByTitle(slug)
    : await wikipediaFromSearchQuery(eventSearchQuery(item));
  return {
    ...media,
    eventDate: item.searchHint.dateRange?.start,
  };
}

/**
 * Artwork nodes: Wikipedia for the work first; many artwork articles have no lead image,
 * so we reuse the artist's page image when the work summary has no thumbnail.
 */
export async function fetchWikipediaArtworkEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  let primary: EnrichedMedia;
  if (slug) {
    primary = await fetchSummaryByTitle(slug);
  } else {
    const q =
      [item.searchHint.title, item.searchHint.creator?.trim()].filter(Boolean).join(" ") ||
      item.name;
    primary = await wikipediaFromSearchQuery(q);
  }

  const creator = item.searchHint.creator?.trim();
  if (!creator || hasWikipediaImage(primary)) {
    return primary;
  }

  const artist = await wikipediaFromSearchQuery(creator);
  if (!hasWikipediaImage(artist)) {
    return primary;
  }

  return {
    ...primary,
    thumbnailUrl: primary.thumbnailUrl ?? artist.thumbnailUrl,
    coverUrl: primary.coverUrl ?? artist.coverUrl,
  };
}

/** Album nodes: Wikipedia search with an album disambiguation suffix. */
export async function fetchWikipediaMusicEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  if (slug) {
    return fetchSummaryByTitle(slug);
  }
  const base =
    [item.searchHint.title, item.searchHint.creator?.trim()].filter(Boolean).join(" ") || item.name;
  return wikipediaFromSearchQuery(`${base} album`);
}

/**
 * Song nodes: tighter Wikipedia search order + validation so ambiguous artist names
 * (e.g. band "Suicide") do not resolve to unrelated topics (e.g. Manet's *Le Suicidé*).
 * Images: song article when trusted; otherwise artist page (band-disambiguated search).
 */
export async function fetchWikipediaSongEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const slug = item.searchHint.wikiSlug?.trim();
  const creator = item.searchHint.creator?.trim();
  const title =
    item.searchHint.title?.trim() || stripTrailingAuthorFromTitle(item.name) || item.name.trim();

  if (slug) {
    const direct = await fetchSummaryByTitle(slug);
    if (!isBadSongWikipediaMatch(direct, title)) {
      return mergeSongWithArtistImageIfNeeded(direct, creator);
    }
  }

  const quoted = title.includes('"') ? title : `"${title}"`;
  const queries: string[] = [];
  if (creator) {
    queries.push(`${quoted} ${creator} song`);
    queries.push(`${quoted} song ${creator}`);
    queries.push(`${title} ${creator} band song`);
    queries.push(`${quoted} ${creator}`);
  }
  queries.push(`${title} song`);
  queries.push(
    `${[item.searchHint.title?.trim(), creator].filter(Boolean).join(" ") || item.name} song`,
  );

  for (const q of queries) {
    if (q.replaceAll('"', "").trim().length < 3) {
      continue;
    }
    const media = await wikipediaFromSearchQuery(q);
    if (!media.wikipediaUrl?.trim() && !media.wikiExtract?.trim()) {
      continue;
    }
    if (isBadSongWikipediaMatch(media, title)) {
      continue;
    }
    return mergeSongWithArtistImageIfNeeded(media, creator);
  }

  return {};
}

function pickCoverThumb(media: EnrichedMedia): { coverUrl?: string; thumbnailUrl?: string } {
  const coverUrl = media.coverUrl ?? media.thumbnailUrl;
  const thumbnailUrl = media.thumbnailUrl ?? media.coverUrl;
  return { coverUrl, thumbnailUrl };
}

/**
 * Cover / thumbnail only — for book enrichment when Google Books has metadata but no images.
 * Tries several Wikipedia search phrasings; many book articles only expose `thumbnail`, not `originalimage`.
 */
export async function fetchWikipediaBookCoverImages(input: {
  title: string;
  creator?: string;
  wikiSlug?: string;
}): Promise<{ coverUrl?: string; thumbnailUrl?: string }> {
  const slug = input.wikiSlug?.trim();
  if (slug) {
    return pickCoverThumb(await fetchSummaryByTitle(slug));
  }

  const baseTitle = stripTrailingAuthorFromTitle(input.title);
  const c = input.creator?.trim();
  const queries = [
    c ? `${baseTitle} ${c} novel` : "",
    c ? `${baseTitle} ${c} book` : "",
    `${baseTitle} novel`,
    `${baseTitle} book`,
    c ? `${baseTitle} ${c}` : "",
    baseTitle,
  ].filter((q) => q.length >= 3);

  for (const q of queries) {
    const media = await wikipediaFromSearchQuery(q);
    const out = pickCoverThumb(media);
    if (out.coverUrl || out.thumbnailUrl) {
      return out;
    }
  }
  return {};
}

/**
 * Cover / thumbnail only for albums when MusicBrainz/Cover Art Archive knows the release group
 * but has no usable artwork.
 */
export async function fetchWikipediaAlbumCoverImages(input: {
  title: string;
  creator?: string;
  wikiSlug?: string;
}): Promise<{ coverUrl?: string; thumbnailUrl?: string }> {
  const slug = input.wikiSlug?.trim();
  if (slug) {
    return pickCoverThumb(await fetchSummaryByTitle(slug));
  }

  const baseTitle = stripTrailingAuthorFromTitle(input.title);
  const c = input.creator?.trim();
  const queries = [
    c ? `${baseTitle} ${c} album` : "",
    `${baseTitle} album`,
    c ? `${baseTitle} ${c}` : "",
    baseTitle,
  ].filter((q) => q.length >= 3);

  for (const q of queries) {
    const media = await wikipediaFromSearchQuery(q);
    const out = pickCoverThumb(media);
    if (out.coverUrl || out.thumbnailUrl) {
      return out;
    }
  }
  return {};
}
