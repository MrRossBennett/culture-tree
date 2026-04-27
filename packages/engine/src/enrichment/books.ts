import type { EnrichedMedia, TreeItem } from "@repo/schemas";

import { fetchWikipediaBookCoverImages } from "./wikipedia";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

/** Secondary / meta works often rank high but aren't the edition we want. */
const DERIVATIVE_TITLE_PATTERN =
  /\b(forty years|years later|medley of|companion to|reader'?s guide|critical essays|casebook|approaches to|revisited|afterword|festschrift|proceedings)\b/i;

type GbVolumeItem = {
  id?: string;
  volumeInfo?: Record<string, unknown>;
};

function httpsify(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

function escapePhrase(s: string): string {
  return s.replace(/"/g, " ").replace(/\s+/g, " ").trim();
}

/** Drop trailing " — Author" when the model folds author into `title`. */
function cleanBookTitleForQuery(title: string): string {
  const trimmed = title.trim();
  const stripped = trimmed.replace(/\s*[—–]\s*[^—–]+$/u, "").trim();
  return stripped.length >= 3 ? stripped : trimmed;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(title: string): Set<string> {
  const stop = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "with"]);
  return new Set(
    normalize(title)
      .split(" ")
      .filter((w) => w.length > 2 && !stop.has(w)),
  );
}

function authorMatches(
  authors: unknown,
  wantAuthor: string | undefined,
): { matches: boolean; score: number } {
  if (!wantAuthor?.trim()) {
    return { matches: true, score: 0 };
  }
  if (!Array.isArray(authors) || authors.length === 0) {
    return { matches: false, score: -30 };
  }
  const hay = authors.map((a) => normalize(String(a))).join(" ");
  const needle = normalize(wantAuthor.trim());
  const parts = needle.split(" ").filter((p) => p.length > 1);
  const allParts = parts.length > 0 && parts.every((p) => hay.includes(p));
  const full = hay.includes(needle);
  if (full || allParts) {
    return { matches: true, score: 55 };
  }
  return { matches: false, score: -45 };
}

function volumeDisplayTitle(volumeInfo: Record<string, unknown>): string {
  const t = typeof volumeInfo.title === "string" ? volumeInfo.title : "";
  const sub = volumeInfo.subtitle;
  if (typeof sub === "string" && sub.trim()) {
    return `${t}: ${sub}`;
  }
  return t;
}

function hasCoverThumbnail(volumeInfo: Record<string, unknown>): boolean {
  const imgs = volumeInfo.imageLinks;
  if (!imgs || typeof imgs !== "object" || imgs === null) {
    return false;
  }
  const o = imgs as Record<string, unknown>;
  return (
    isPossiblyUsableGoogleBooksImage(o.thumbnail) ||
    isPossiblyUsableGoogleBooksImage(o.smallThumbnail)
  );
}

function scoreVolume(
  volumeInfo: Record<string, unknown>,
  wantTitle: string,
  wantAuthor: string | undefined,
): number {
  const fullTitle = volumeDisplayTitle(volumeInfo);
  const normWant = normalize(wantTitle);
  const normVol = normalize(fullTitle);
  let score = 0;

  if (normWant.length >= 6 && normVol === normWant) {
    score += 40;
  }

  if (normWant.length >= 6 && normVol.includes(normWant)) {
    score += 120;
  }

  const wantTok = significantTokens(wantTitle);
  const volTok = significantTokens(fullTitle);
  for (const w of wantTok) {
    if (volTok.has(w)) {
      score += 18;
    }
  }

  const lenRatio = fullTitle.length / Math.max(wantTitle.length, 1);
  if (lenRatio > 1.6) {
    score -= 25;
  }
  if (lenRatio > 2.2) {
    score -= 35;
  }

  if (DERIVATIVE_TITLE_PATTERN.test(fullTitle)) {
    score -= 80;
  }

  const { score: authorScore } = authorMatches(volumeInfo.authors, wantAuthor);
  score += authorScore;

  if (hasCoverThumbnail(volumeInfo)) {
    score += 45;
  }

  return score;
}

function pickBestItem(
  items: GbVolumeItem[] | undefined,
  wantTitle: string,
  wantAuthor: string | undefined,
): GbVolumeItem | undefined {
  if (!items?.length) {
    return undefined;
  }
  const valid = items.filter((it): it is GbVolumeItem & { volumeInfo: Record<string, unknown> } =>
    Boolean(it.volumeInfo),
  );
  if (valid.length === 0) {
    return undefined;
  }
  const withCover = valid.filter((it) => hasCoverThumbnail(it.volumeInfo));
  const pool = withCover.length > 0 ? withCover : valid;

  let best: (typeof valid)[number] | undefined;
  let bestScore = -Infinity;
  for (const it of pool) {
    const s = scoreVolume(it.volumeInfo, wantTitle, wantAuthor);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}

function rankedItems(
  items: GbVolumeItem[] | undefined,
  wantTitle: string,
  wantAuthor: string | undefined,
): Array<GbVolumeItem & { volumeInfo: Record<string, unknown> }> {
  if (!items?.length) {
    return [];
  }
  return items
    .filter((it): it is GbVolumeItem & { volumeInfo: Record<string, unknown> } =>
      Boolean(it.volumeInfo),
    )
    .sort(
      (left, right) =>
        scoreVolume(right.volumeInfo, wantTitle, wantAuthor) -
        scoreVolume(left.volumeInfo, wantTitle, wantAuthor),
    );
}

function buildQuery(title: string, creator: string | undefined, isbn: string | undefined): string {
  const t = escapePhrase(cleanBookTitleForQuery(title));
  if (isbn?.trim()) {
    return `isbn:${isbn.trim()}`;
  }
  if (creator?.trim()) {
    const a = escapePhrase(creator.trim());
    return `intitle:"${t}"+inauthor:"${a}"`;
  }
  return `intitle:"${t}"`;
}

function volumeIdFromGoogleBooksUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  try {
    const id = new URL(url).searchParams.get("id");
    return id?.trim() || undefined;
  } catch {
    const m = url.match(/[?&]id=([^&]+)/);
    if (!m?.[1]) {
      return undefined;
    }
    try {
      return decodeURIComponent(m[1]).trim() || undefined;
    } catch {
      return m[1].trim() || undefined;
    }
  }
}

function googleBooksEditionUrl(
  volumeId: string | undefined,
  infoLink: string | undefined,
): string | undefined {
  const id = volumeId?.trim() || volumeIdFromGoogleBooksUrl(infoLink);
  if (id) {
    return `https://books.google.com/books?id=${encodeURIComponent(id)}&hl=en`;
  }
  return httpsify(infoLink);
}

function googleBooksImageUrl(url: unknown): string | undefined {
  return typeof url === "string" ? httpsify(url) : undefined;
}

function isGoogleBooksContentImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "books.google.com" && parsed.pathname.includes("/books/content");
  } catch {
    return false;
  }
}

function isLikelyGoogleBooksPlaceholderUrl(url: string | undefined): boolean {
  if (!url || !isGoogleBooksContentImage(url)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return !parsed.searchParams.has("edge") && !parsed.searchParams.has("imgtk");
  } catch {
    return false;
  }
}

function isPossiblyUsableGoogleBooksImage(url: unknown): boolean {
  const imageUrl = googleBooksImageUrl(url);
  return Boolean(imageUrl && !isLikelyGoogleBooksPlaceholderUrl(imageUrl));
}

async function isUsableGoogleBooksImage(url: string | undefined): Promise<boolean> {
  if (!url) {
    return false;
  }
  if (!isGoogleBooksContentImage(url)) {
    return true;
  }
  if (isLikelyGoogleBooksPlaceholderUrl(url)) {
    return false;
  }

  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(3_000),
  }).catch(() => null);

  if (response?.ok) {
    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength)) {
      return contentLength > 2_500;
    }
    return true;
  }

  const imageResponse = await fetch(url, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
  if (!imageResponse?.ok) {
    return false;
  }
  const bytes = await imageResponse.arrayBuffer();
  return bytes.byteLength > 2_500;
}

async function usableImageLinks(
  imageLinks: Record<string, string> | undefined,
): Promise<{ coverUrl?: string; thumbnailUrl?: string }> {
  const thumbnail = googleBooksImageUrl(imageLinks?.thumbnail);
  const smallThumbnail = googleBooksImageUrl(imageLinks?.smallThumbnail);
  const coverUrl = thumbnail ? thumbnail.replace("zoom=1", "zoom=2") : undefined;
  const thumbnailUrl = smallThumbnail;

  const [coverOk, thumbnailOk] = await Promise.all([
    isUsableGoogleBooksImage(coverUrl),
    isUsableGoogleBooksImage(thumbnailUrl),
  ]);

  return {
    coverUrl: coverOk ? coverUrl : undefined,
    thumbnailUrl: thumbnailOk ? thumbnailUrl : undefined,
  };
}

async function mediaFromGoogleBooksItem(
  picked: GbVolumeItem & { volumeInfo: Record<string, unknown> },
): Promise<EnrichedMedia> {
  const book = picked.volumeInfo;
  const imageLinks = book.imageLinks as Record<string, string> | undefined;
  const { coverUrl, thumbnailUrl } = await usableImageLinks(imageLinks);
  const infoLink = typeof book.infoLink === "string" ? book.infoLink : undefined;
  const resolvedId = picked.id?.trim() || volumeIdFromGoogleBooksUrl(infoLink);

  return {
    coverUrl,
    thumbnailUrl,
    externalUrl: googleBooksEditionUrl(resolvedId, infoLink),
    description: typeof book.description === "string" ? book.description.slice(0, 500) : undefined,
    rating: typeof book.averageRating === "number" ? book.averageRating : undefined,
  };
}

async function fetchFromGoogleBooks(item: TreeItem): Promise<EnrichedMedia> {
  const rawTitle = item.searchHint.title;
  const titleForScore = cleanBookTitleForQuery(rawTitle);
  const q = buildQuery(rawTitle, item.searchHint.creator, item.searchHint.isbn);

  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", "40");
  if (key) {
    url.searchParams.set("key", key);
  }

  const res = await fetch(url);
  if (!res.ok) {
    return {};
  }
  const data = (await res.json()) as { items?: GbVolumeItem[] };
  let fallback: EnrichedMedia = {};

  for (const picked of rankedItems(data.items, titleForScore, item.searchHint.creator?.trim())) {
    const media = await mediaFromGoogleBooksItem(picked);
    if (!fallback.externalUrl) {
      fallback = media;
    }
    if (media.coverUrl || media.thumbnailUrl) {
      return media;
    }
  }

  const picked = pickBestItem(data.items, titleForScore, item.searchHint.creator?.trim());
  return picked ? fallback : {};
}

export async function fetchBookEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const gb = await fetchFromGoogleBooks(item);
  if (!gb.coverUrl && !gb.thumbnailUrl) {
    const wiki = await fetchWikipediaBookCoverImages({
      title: item.searchHint.title,
      creator: item.searchHint.creator,
      wikiSlug: item.searchHint.wikiSlug,
    });
    if (wiki.coverUrl) {
      gb.coverUrl = httpsify(wiki.coverUrl);
    }
    if (wiki.thumbnailUrl) {
      gb.thumbnailUrl = httpsify(wiki.thumbnailUrl);
    }
  }
  return gb;
}
