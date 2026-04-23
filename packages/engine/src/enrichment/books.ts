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
  return typeof o.thumbnail === "string" || typeof o.smallThumbnail === "string";
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
  const picked = pickBestItem(data.items, titleForScore, item.searchHint.creator?.trim());
  const book = picked?.volumeInfo;
  if (!book) {
    return {};
  }

  const imageLinks = book.imageLinks as Record<string, string> | undefined;
  const thumb = imageLinks?.thumbnail;
  const small = imageLinks?.smallThumbnail;
  const coverUrl = httpsify(thumb?.replace("zoom=1", "zoom=2") ?? thumb);
  const thumbnailUrl = httpsify(small);
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
