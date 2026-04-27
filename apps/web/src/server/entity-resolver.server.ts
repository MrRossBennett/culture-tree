import { db } from "@repo/db";
import {
  cultureTree,
  entity,
  entityExternalIdentity,
  entityLike,
  entityResolutionJob,
  enrichmentCache,
  treeItemEntity,
} from "@repo/db/schema";
import {
  CultureTreeSchema,
  TreeItemSchema,
  type EnrichedMedia,
  type ExternalNodeSourceValue,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { and, count, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const ENTITY_RESOLVER_BATCH_LIMIT = 5;
const MAX_JOB_ATTEMPTS = 3;
const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_BASE = "https://coverartarchive.org";
const TMDB_BASE = "https://api.themoviedb.org/3";
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

type ExternalIdentityInput = {
  source: ExternalNodeSourceValue;
  externalType: string;
  externalId: string;
  externalUrl?: string;
};

type EntityDisplayInput = {
  type: NodeTypeValue;
  name: string;
  creatorName?: string;
  creatorRole?: string;
  disambiguation?: string;
  year?: number;
  imageUrl?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type ResolvedEntitySummary = {
  id: string;
  type: string;
  name: string;
  creatorName: string | null;
  creatorRole: string | null;
  disambiguation: string | null;
  year: number | null;
  imageUrl: string | null;
  description: string | null;
  likeCount: number;
  appearanceCount: number;
  likedByCurrentUser: boolean;
};

export type TreeResolvedEntitiesMap = Record<string, ResolvedEntitySummary>;

type ResolverCandidate = EntityDisplayInput & ExternalIdentityInput;

type ResolutionResult =
  | { status: "resolved"; entityId: string }
  | { status: "skipped"; reason: string };

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function resolverCacheKey(item: TreeItem): string {
  const input = stableStringify({
    type: item.type,
    name: item.name,
    year: item.year,
    searchHint: item.searchHint,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseCachedCandidate(value: unknown): ResolverCandidate | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = (value as { candidate?: unknown }).candidate;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const c = candidate as Partial<ResolverCandidate>;
  if (
    typeof c.source !== "string" ||
    typeof c.externalType !== "string" ||
    typeof c.externalId !== "string" ||
    typeof c.type !== "string" ||
    typeof c.name !== "string"
  ) {
    return null;
  }
  return c as ResolverCandidate;
}

async function getCachedResolverCandidate(item: TreeItem): Promise<ResolverCandidate | null> {
  const [row] = await db
    .select({ data: enrichmentCache.data })
    .from(enrichmentCache)
    .where(eq(enrichmentCache.searchHintHash, `entity:v2:${resolverCacheKey(item)}`))
    .limit(1);
  return parseCachedCandidate(row?.data);
}

async function setCachedResolverCandidate(
  item: TreeItem,
  candidate: ResolverCandidate,
): Promise<void> {
  await db
    .insert(enrichmentCache)
    .values({
      id: nanoid(),
      searchHintHash: `entity:v2:${resolverCacheKey(item)}`,
      nodeType: `entity-resolver:${item.type}`,
      data: { candidate },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })
    .onConflictDoUpdate({
      target: enrichmentCache.searchHintHash,
      set: {
        data: { candidate },
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });
}

function titleLooksConfident(found: string | undefined, wanted: string): boolean {
  if (!found?.trim() || !wanted.trim()) {
    return false;
  }
  const left = normalizeForMatch(found);
  const right = normalizeForMatch(wanted);
  return left === right || left.includes(right) || right.includes(left);
}

function creatorRoleForType(type: NodeTypeValue): string | undefined {
  if (type === "book") {
    return "author";
  }
  if (type === "album" || type === "song") {
    return "artist";
  }
  if (type === "film" || type === "tv") {
    return "director";
  }
  if (type === "artwork") {
    return "artist";
  }
  if (type === "podcast") {
    return "creator";
  }
  return undefined;
}

function disambiguationFor(type: NodeTypeValue, year: number | undefined): string {
  return year != null ? `${year} ${type}` : type;
}

const ATTRIBUTED_WORK_TYPES = new Set<NodeTypeValue>([
  "book",
  "album",
  "song",
  "film",
  "tv",
  "artwork",
  "podcast",
]);

function canonicalNameFromItem(item: TreeItem): string {
  const title = item.searchHint.title?.trim();
  if (title && ATTRIBUTED_WORK_TYPES.has(item.type)) {
    return title;
  }
  return item.snapshot?.name ?? item.name;
}

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(/\b(18|19|20)\d{2}\b/);
  return match?.[0] ? Number.parseInt(match[0], 10) : undefined;
}

function normalizeWikipediaKey(titleOrUrl: string): string | undefined {
  const trimmed = titleOrUrl.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const wikiIndex = parts.indexOf("wiki");
    const slug = wikiIndex >= 0 ? parts[wikiIndex + 1] : parts.at(-1);
    return slug ? decodeURIComponent(slug).replaceAll(" ", "_") : undefined;
  } catch {
    return trimmed.replaceAll(" ", "_");
  }
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

function hasTmdbCredentials(): boolean {
  return Boolean(process.env.TMDB_ACCESS_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim());
}

function parseTreeIdentity(item: TreeItem): ExternalIdentityInput | null {
  const identity = item.identity;
  if (!identity) {
    return null;
  }

  if (identity.source === "tmdb") {
    const [kind, id] = identity.externalId.split(":");
    if ((kind === "movie" || kind === "tv") && id?.trim()) {
      return {
        source: "tmdb",
        externalType: kind,
        externalId: id.trim(),
        externalUrl: `https://www.themoviedb.org/${kind}/${id.trim()}`,
      };
    }
    return null;
  }

  if (identity.source === "google-books") {
    return {
      source: "google-books",
      externalType: "volume",
      externalId: identity.externalId,
      externalUrl: `https://books.google.com/books?id=${encodeURIComponent(identity.externalId)}`,
    };
  }

  if (identity.source === "wikipedia") {
    const slug = normalizeWikipediaKey(identity.externalId);
    if (!slug) {
      return null;
    }
    return {
      source: "wikipedia",
      externalType: "page",
      externalId: slug,
      externalUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
    };
  }

  if (identity.source === "musicbrainz") {
    return {
      source: "musicbrainz",
      externalType: musicBrainzExternalTypeForNode(item.type) ?? item.type,
      externalId: identity.externalId,
      externalUrl: musicBrainzUrlForNode(item.type, identity.externalId),
    };
  }

  return null;
}

function candidateFromKnownIdentity(
  item: TreeItem,
  media: EnrichedMedia | undefined,
): ResolverCandidate | null {
  const identity = parseTreeIdentity(item);
  if (!identity) {
    if ((item.type === "film" || item.type === "tv") && media?.externalId?.trim()) {
      const tmdbType = item.type === "film" ? "movie" : "tv";
      return {
        source: "tmdb",
        externalType: tmdbType,
        externalId: media.externalId.trim(),
        externalUrl: `https://www.themoviedb.org/${tmdbType}/${media.externalId.trim()}`,
        ...displayFromItem(item, media),
      };
    }
    const wikipediaSlug = media?.wikipediaUrl ? normalizeWikipediaKey(media.wikipediaUrl) : null;
    if (wikipediaSlug && wikipediaFallbackTypes.has(item.type)) {
      return {
        source: "wikipedia",
        externalType: "page",
        externalId: wikipediaSlug,
        externalUrl: media?.wikipediaUrl,
        ...displayFromItem(item, media),
      };
    }
    return null;
  }

  return {
    ...identity,
    ...displayFromItem(item, media),
  };
}

function displayFromItem(item: TreeItem, media: EnrichedMedia | undefined): EntityDisplayInput {
  const year = item.snapshot?.year ?? item.year;
  const creatorName = item.searchHint.creator?.trim() || undefined;
  return {
    type: item.type,
    name: canonicalNameFromItem(item),
    creatorName,
    creatorRole: creatorName ? creatorRoleForType(item.type) : undefined,
    disambiguation: disambiguationFor(item.type, year),
    year,
    imageUrl: item.snapshot?.image ?? media?.coverUrl ?? media?.thumbnailUrl,
    description: media?.description ?? media?.wikiExtract,
    metadata: { searchHint: item.searchHint },
  };
}

function withItemAttribution(item: TreeItem, candidate: ResolverCandidate): ResolverCandidate {
  const creatorName = candidate.creatorName ?? item.searchHint.creator?.trim() ?? undefined;
  const year = candidate.year ?? item.year;
  return {
    ...candidate,
    name: ATTRIBUTED_WORK_TYPES.has(item.type) ? canonicalNameFromItem(item) : candidate.name,
    creatorName,
    creatorRole: candidate.creatorRole ?? (creatorName ? creatorRoleForType(item.type) : undefined),
    disambiguation: candidate.disambiguation ?? disambiguationFor(item.type, year),
    year,
    metadata: {
      ...candidate.metadata,
      searchHint: item.searchHint,
    },
  };
}

async function upsertEntityFromExternalIdentity(input: ResolverCandidate): Promise<string> {
  const [existingIdentity] = await db
    .select({ entityId: entityExternalIdentity.entityId })
    .from(entityExternalIdentity)
    .where(
      and(
        eq(entityExternalIdentity.source, input.source),
        eq(entityExternalIdentity.externalType, input.externalType),
        eq(entityExternalIdentity.externalId, input.externalId),
      ),
    )
    .limit(1);

  if (existingIdentity) {
    await db
      .update(entity)
      .set({
        name: input.name,
        creatorName: input.creatorName,
        creatorRole: input.creatorRole,
        disambiguation: input.disambiguation,
        year: input.year,
        imageUrl: input.imageUrl,
        description: input.description,
        metadata: input.metadata,
      })
      .where(eq(entity.id, existingIdentity.entityId));
    return existingIdentity.entityId;
  }

  const nextEntityId = nanoid();
  await db
    .insert(entity)
    .values({
      id: nextEntityId,
      type: input.type,
      name: input.name,
      creatorName: input.creatorName,
      creatorRole: input.creatorRole,
      disambiguation: input.disambiguation,
      year: input.year,
      imageUrl: input.imageUrl,
      description: input.description,
      primaryExternalSource: input.source,
      primaryExternalType: input.externalType,
      primaryExternalId: input.externalId,
      metadata: input.metadata,
    })
    .onConflictDoNothing({
      target: [entity.primaryExternalSource, entity.primaryExternalType, entity.primaryExternalId],
    });

  const [canonicalEntity] = await db
    .select({ id: entity.id })
    .from(entity)
    .where(
      and(
        eq(entity.primaryExternalSource, input.source),
        eq(entity.primaryExternalType, input.externalType),
        eq(entity.primaryExternalId, input.externalId),
      ),
    )
    .limit(1);

  if (!canonicalEntity) {
    throw new Error("Could not create entity");
  }

  await db
    .insert(entityExternalIdentity)
    .values({
      id: nanoid(),
      entityId: canonicalEntity.id,
      source: input.source,
      externalType: input.externalType,
      externalId: input.externalId,
      externalUrl: input.externalUrl,
    })
    .onConflictDoNothing({
      target: [
        entityExternalIdentity.source,
        entityExternalIdentity.externalType,
        entityExternalIdentity.externalId,
      ],
    });
  return canonicalEntity.id;
}

export async function linkTreeItemToEntity(input: {
  treeId: string;
  itemId: string;
  entityId: string;
}): Promise<void> {
  await db
    .insert(treeItemEntity)
    .values({
      id: nanoid(),
      treeId: input.treeId,
      itemId: input.itemId,
      entityId: input.entityId,
    })
    .onConflictDoNothing({
      target: [treeItemEntity.treeId, treeItemEntity.itemId],
    });
}

async function resolveWithCandidate(input: {
  treeId: string;
  item: TreeItem;
  candidate: ResolverCandidate;
}): Promise<ResolutionResult> {
  const entityId = await upsertEntityFromExternalIdentity(
    withItemAttribution(input.item, input.candidate),
  );
  await linkTreeItemToEntity({ treeId: input.treeId, itemId: input.item.id, entityId });
  return { status: "resolved", entityId };
}

const wikipediaFallbackTypes = new Set<NodeTypeValue>(["person", "place", "event", "artwork"]);

function sourceCanCreateEntityForType(
  source: ExternalNodeSourceValue,
  type: NodeTypeValue,
): boolean {
  if (type === "film" || type === "tv") {
    return source === "tmdb";
  }
  if (type === "artist" || type === "album" || type === "song") {
    return source === "musicbrainz";
  }
  if (type === "book") {
    return source === "google-books";
  }
  if (wikipediaFallbackTypes.has(type)) {
    return source === "wikipedia";
  }
  return false;
}

async function resolveKnownIdentity(input: {
  treeId: string;
  item: TreeItem;
  media?: EnrichedMedia;
}): Promise<ResolutionResult | null> {
  const candidate = candidateFromKnownIdentity(input.item, input.media);
  if (!candidate) {
    return null;
  }
  if (!sourceCanCreateEntityForType(candidate.source, input.item.type)) {
    return { status: "skipped", reason: "source-not-primary-for-type" };
  }
  return resolveWithCandidate({ treeId: input.treeId, item: input.item, candidate });
}

async function resolveTmdb(item: TreeItem): Promise<ResolverCandidate | null> {
  if ((item.type !== "film" && item.type !== "tv") || !hasTmdbCredentials()) {
    return null;
  }
  const tmdbType = item.type === "film" ? "movie" : "tv";
  const url = new URL(`${TMDB_BASE}/search/${tmdbType}`);
  url.searchParams.set("query", item.searchHint.title || item.name);
  if (item.year != null) {
    url.searchParams.set(tmdbType === "movie" ? "year" : "first_air_date_year", String(item.year));
  }
  const response = await fetch(url, tmdbFetchInit(url));
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    results?: Array<{
      id?: number;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      poster_path?: string | null;
      overview?: string;
    }>;
  };
  const match = data.results?.find((result) => {
    const title = tmdbType === "movie" ? result.title : result.name;
    return titleLooksConfident(title, item.searchHint.title || item.name);
  });
  if (match?.id == null) {
    return null;
  }
  const name = (tmdbType === "movie" ? match.title : match.name) ?? item.name;
  const year = parseYear(tmdbType === "movie" ? match.release_date : match.first_air_date);
  const imageUrl = match.poster_path
    ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
    : undefined;
  const creatorName = item.searchHint.creator?.trim() || undefined;
  return {
    source: "tmdb",
    externalType: tmdbType,
    externalId: String(match.id),
    externalUrl: `https://www.themoviedb.org/${tmdbType}/${match.id}`,
    type: item.type,
    name,
    creatorName,
    creatorRole: creatorName ? "director" : undefined,
    year: year ?? item.year,
    imageUrl,
    description: match.overview,
    metadata: { searchHint: item.searchHint },
  };
}

let lastMusicBrainzRequestAt = 0;

async function musicBrainzFetch(url: URL): Promise<Response> {
  const elapsed = Date.now() - lastMusicBrainzRequestAt;
  if (elapsed < 1_000) {
    await new Promise((resolve) => setTimeout(resolve, 1_000 - elapsed));
  }
  lastMusicBrainzRequestAt = Date.now();
  const userAgent =
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "CultureTreeLocal/0.1 (local development; contact: ross@culturetree.local)";
  return fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
  });
}

function musicBrainzExternalTypeForNode(type: NodeTypeValue): string | null {
  if (type === "artist") {
    return "artist";
  }
  if (type === "album") {
    return "release-group";
  }
  if (type === "song") {
    return "recording";
  }
  return null;
}

function musicBrainzUrlForNode(type: NodeTypeValue, mbid: string): string | undefined {
  const externalType = musicBrainzExternalTypeForNode(type);
  return externalType ? `https://musicbrainz.org/${externalType}/${mbid}` : undefined;
}

function musicTitleSearchVariants(title: string, type: NodeTypeValue): string[] {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return [];
  }

  const variants = [trimmed];
  if (type === "album") {
    const stripped = trimmed
      .replace(/\s*[:\-–—]?\s*(original\s+motion\s+picture\s+)?(score|soundtrack|ost)\s*$/i, "")
      .trim();
    if (stripped.length >= 3) {
      variants.push(stripped);
    }
  }

  return Array.from(new Set(variants));
}

async function fetchReleaseGroupCoverArt(releaseGroupMbid: string): Promise<string | undefined> {
  const url = `${COVER_ART_ARCHIVE_BASE}/release-group/${encodeURIComponent(releaseGroupMbid)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
        "CultureTreeLocal/0.1 (local development; contact: ross@culturetree.local)",
    },
  });
  if (!response.ok) {
    return undefined;
  }
  const data = (await response.json()) as {
    images?: Array<{
      front?: boolean;
      image?: string;
      thumbnails?: { large?: string; small?: string };
    }>;
  };
  const front = data.images?.find((image) => image.front) ?? data.images?.[0];
  return front?.thumbnails?.large ?? front?.image ?? front?.thumbnails?.small;
}

async function resolveMusicBrainz(item: TreeItem): Promise<ResolverCandidate | null> {
  const externalType = musicBrainzExternalTypeForNode(item.type);
  if (!externalType) {
    return null;
  }
  type MusicBrainzSearchData = {
    artists?: Array<{ id?: string; name?: string; disambiguation?: string }>;
    "release-groups"?: Array<{
      id?: string;
      title?: string;
      "first-release-date"?: string;
      "artist-credit"?: Array<{ name?: string }>;
    }>;
    recordings?: Array<{
      id?: string;
      title?: string;
      "first-release-date"?: string;
      "artist-credit"?: Array<{ name?: string }>;
    }>;
  };

  async function searchWithTitle(title: string): Promise<MusicBrainzSearchData | null> {
    const url = new URL(`${MUSICBRAINZ_BASE}/${externalType}`);
    const creator = item.searchHint.creator?.trim();
    if (item.type === "artist") {
      url.searchParams.set("query", `artist:"${title.replaceAll('"', "")}"`);
    } else if (item.type === "album") {
      url.searchParams.set(
        "query",
        [
          `releasegroup:"${title.replaceAll('"', "")}"`,
          creator ? `artistname:"${creator.replaceAll('"', "")}"` : "",
        ]
          .filter(Boolean)
          .join(" AND "),
      );
    } else {
      url.searchParams.set(
        "query",
        [
          `recording:"${title.replaceAll('"', "")}"`,
          creator ? `artistname:"${creator.replaceAll('"', "")}"` : "",
        ]
          .filter(Boolean)
          .join(" AND "),
      );
    }
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");

    const response = await musicBrainzFetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MusicBrainzSearchData;
  }

  const wantedTitles = musicTitleSearchVariants(item.searchHint.title || item.name, item.type);
  const searches = await Promise.all(wantedTitles.map((title) => searchWithTitle(title)));
  if (item.type === "artist") {
    const match = searches
      .flatMap((data) => data?.artists ?? [])
      .find((artist) => wantedTitles.some((wanted) => titleLooksConfident(artist.name, wanted)));
    if (!match?.id || !match.name) {
      return null;
    }
    return {
      source: "musicbrainz",
      externalType,
      externalId: match.id,
      externalUrl: musicBrainzUrlForNode(item.type, match.id),
      type: item.type,
      name: match.name,
      description: match.disambiguation,
      metadata: { searchHint: item.searchHint },
    };
  }

  const rows = searches.flatMap((data) =>
    item.type === "album" ? (data?.["release-groups"] ?? []) : (data?.recordings ?? []),
  );
  const match = rows.find((row) =>
    wantedTitles.some((wanted) => titleLooksConfident(row.title, wanted)),
  );
  if (!match?.id || !match.title) {
    return null;
  }
  const artistCredit = match["artist-credit"]?.map((credit) => credit.name).filter(Boolean) ?? [];
  const creatorName = item.searchHint.creator?.trim() || artistCredit[0];
  const imageUrl = item.type === "album" ? await fetchReleaseGroupCoverArt(match.id) : undefined;
  return {
    source: "musicbrainz",
    externalType,
    externalId: match.id,
    externalUrl: musicBrainzUrlForNode(item.type, match.id),
    type: item.type,
    name: match.title,
    creatorName,
    creatorRole: creatorName ? "artist" : undefined,
    year: parseYear(match["first-release-date"]),
    imageUrl,
    metadata: {
      searchHint: item.searchHint,
      artistCredit,
    },
  };
}

const DERIVATIVE_BOOK_TITLE_PATTERN =
  /\b(companion|guide|study guide|critical|criticism|essays|collected|collection|reader|revisited|casebook|approaches|analysis|biography|life of)\b/i;

function isLikelyDerivativeBookTitle(title: string, item: TreeItem): boolean {
  if (DERIVATIVE_BOOK_TITLE_PATTERN.test(title)) {
    return true;
  }
  const creator = item.searchHint.creator?.trim();
  if (!creator) {
    return false;
  }
  const normalizedTitle = normalizeForMatch(title);
  const normalizedCreator = normalizeForMatch(creator);
  return normalizedTitle.startsWith(`${normalizedCreator} s `);
}

async function resolveGoogleBooks(item: TreeItem): Promise<ResolverCandidate | null> {
  if (item.type !== "book") {
    return null;
  }
  const query = item.searchHint.isbn?.trim()
    ? `isbn:${item.searchHint.isbn.trim()}`
    : [item.searchHint.title || item.name, item.searchHint.creator]
        .filter(Boolean)
        .map((part) => `"${String(part).replaceAll('"', "")}"`)
        .join("+");
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "5");
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (key) {
    url.searchParams.set("key", key);
  }
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    items?: Array<{
      id?: string;
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publishedDate?: string;
        description?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
        infoLink?: string;
      };
    }>;
  };
  const match = data.items?.find((row) =>
    Boolean(
      row.volumeInfo?.title &&
      !isLikelyDerivativeBookTitle(row.volumeInfo.title, item) &&
      titleLooksConfident(row.volumeInfo.title, item.searchHint.title || item.name),
    ),
  );
  if (!match?.id || !match.volumeInfo?.title) {
    return null;
  }
  const name = match.volumeInfo.subtitle
    ? `${match.volumeInfo.title}: ${match.volumeInfo.subtitle}`
    : match.volumeInfo.title;
  const creatorName = item.searchHint.creator?.trim() || match.volumeInfo.authors?.[0];
  return {
    source: "google-books",
    externalType: "volume",
    externalId: match.id,
    externalUrl: `https://books.google.com/books?id=${encodeURIComponent(match.id)}`,
    type: item.type,
    name,
    creatorName,
    creatorRole: creatorName ? "author" : undefined,
    year: parseYear(match.volumeInfo.publishedDate),
    imageUrl: match.volumeInfo.imageLinks?.thumbnail ?? match.volumeInfo.imageLinks?.smallThumbnail,
    description: match.volumeInfo.description?.slice(0, 500),
    metadata: { searchHint: item.searchHint, authors: match.volumeInfo.authors },
  };
}

async function fetchWikipediaSummary(title: string) {
  const path = encodeURIComponent(title.replaceAll(" ", "_"));
  const response = await fetch(`${WIKI_REST}/page/summary/${path}`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as {
    title?: string;
    extract?: string;
    description?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
}

async function resolveWikipedia(item: TreeItem): Promise<ResolverCandidate | null> {
  if (!wikipediaFallbackTypes.has(item.type)) {
    return null;
  }
  const directSlug = item.searchHint.wikiSlug?.trim();
  let title = directSlug;
  if (!title) {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("format", "json");
    url.searchParams.set("srlimit", "3");
    url.searchParams.set("srsearch", item.searchHint.title || item.name);
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { query?: { search?: Array<{ title?: string }> } };
    title = data.query?.search?.find((row) =>
      titleLooksConfident(row.title, item.searchHint.title || item.name),
    )?.title;
  }
  if (!title) {
    return null;
  }
  const summary = await fetchWikipediaSummary(title);
  if (!summary?.title || !titleLooksConfident(summary.title, item.searchHint.title || item.name)) {
    return null;
  }
  const slug = normalizeWikipediaKey(summary.title);
  if (!slug) {
    return null;
  }
  const creatorName = item.searchHint.creator?.trim() || undefined;
  return {
    source: "wikipedia",
    externalType: "page",
    externalId: slug,
    externalUrl: summary.content_urls?.desktop?.page,
    type: item.type,
    name: summary.title,
    creatorName,
    creatorRole: creatorName ? creatorRoleForType(item.type) : undefined,
    imageUrl: summary.originalimage?.source ?? summary.thumbnail?.source,
    description: summary.extract?.slice(0, 500) ?? summary.description,
    metadata: { searchHint: item.searchHint },
  };
}

async function resolveViaPrimaryAuthority(item: TreeItem): Promise<ResolverCandidate | null> {
  const cached = await getCachedResolverCandidate(item);
  if (cached) {
    return cached;
  }

  let candidate: ResolverCandidate | null;
  if (item.type === "film" || item.type === "tv") {
    candidate = await resolveTmdb(item);
  } else if (item.type === "artist" || item.type === "album" || item.type === "song") {
    candidate = await resolveMusicBrainz(item);
  } else if (item.type === "book") {
    candidate = await resolveGoogleBooks(item);
  } else {
    candidate = await resolveWikipedia(item);
  }

  if (candidate) {
    await setCachedResolverCandidate(item, candidate);
  }
  return candidate;
}

export async function resolveTreeItem(input: {
  treeId: string;
  item: TreeItem;
  media?: EnrichedMedia;
}): Promise<ResolutionResult> {
  const [existingLink] = await db
    .select({ entityId: treeItemEntity.entityId })
    .from(treeItemEntity)
    .where(and(eq(treeItemEntity.treeId, input.treeId), eq(treeItemEntity.itemId, input.item.id)))
    .limit(1);
  if (existingLink) {
    return { status: "resolved", entityId: existingLink.entityId };
  }

  const known = await resolveKnownIdentity(input);
  if (known) {
    return known;
  }

  const candidate = await resolveViaPrimaryAuthority(input.item);
  if (!candidate) {
    return { status: "skipped", reason: "no-confident-match" };
  }
  return resolveWithCandidate({ treeId: input.treeId, item: input.item, candidate });
}

export async function resolveImmediateTreeItems(input: {
  treeId: string;
  items: TreeItem[];
  enrichments?: TreeEnrichmentsMap;
}): Promise<void> {
  await Promise.allSettled(
    input.items.map(async (item) => {
      const known = await resolveKnownIdentity({
        treeId: input.treeId,
        item,
        media: input.enrichments?.[item.id],
      });
      if (!known || known.status !== "resolved") {
        await enqueueEntityResolutionJob({ treeId: input.treeId, item });
      }
    }),
  );
}

export async function enqueueEntityResolutionJob(input: {
  treeId: string;
  item: TreeItem;
}): Promise<void> {
  if (!sourceCanCreateEntityForType(primarySourceForType(input.item.type), input.item.type)) {
    return;
  }
  const [existingLink] = await db
    .select({ id: treeItemEntity.id })
    .from(treeItemEntity)
    .where(and(eq(treeItemEntity.treeId, input.treeId), eq(treeItemEntity.itemId, input.item.id)))
    .limit(1);
  if (existingLink) {
    return;
  }
  await db
    .insert(entityResolutionJob)
    .values({
      id: nanoid(),
      treeId: input.treeId,
      itemId: input.item.id,
      itemSnapshot: input.item,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [entityResolutionJob.treeId, entityResolutionJob.itemId],
    });
}

function primarySourceForType(type: NodeTypeValue): ExternalNodeSourceValue {
  if (type === "film" || type === "tv") {
    return "tmdb";
  }
  if (type === "artist" || type === "album" || type === "song") {
    return "musicbrainz";
  }
  if (type === "book") {
    return "google-books";
  }
  return "wikipedia";
}

export async function processEntityResolutionJobs(
  input: { limit?: number } = {},
): Promise<{ processed: number; resolved: number; skipped: number; failed: number }> {
  const limit = Math.max(1, Math.min(input.limit ?? ENTITY_RESOLVER_BATCH_LIMIT, 25));
  const now = new Date();
  const jobs = await db
    .select()
    .from(entityResolutionJob)
    .where(
      and(eq(entityResolutionJob.status, "pending"), lte(entityResolutionJob.scheduledAt, now)),
    )
    .orderBy(entityResolutionJob.scheduledAt)
    .limit(limit);

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    await db
      .update(entityResolutionJob)
      .set({ status: "running", lockedAt: new Date(), attempts: job.attempts + 1 })
      .where(eq(entityResolutionJob.id, job.id));

    try {
      const item = TreeItemSchema.parse(job.itemSnapshot);
      const result = await resolveTreeItem({ treeId: job.treeId, item });
      if (result.status === "resolved") {
        resolved += 1;
      } else {
        skipped += 1;
      }
      await db
        .update(entityResolutionJob)
        .set({ status: result.status, completedAt: new Date(), lastError: null })
        .where(eq(entityResolutionJob.id, job.id));
    } catch (error) {
      failed += 1;
      const nextAttempts = job.attempts + 1;
      const retry = nextAttempts < MAX_JOB_ATTEMPTS;
      await db
        .update(entityResolutionJob)
        .set({
          status: retry ? "pending" : "failed",
          attempts: nextAttempts,
          scheduledAt: new Date(Date.now() + nextAttempts * 60_000),
          lastError: error instanceof Error ? error.message : "Unknown resolver error",
        })
        .where(eq(entityResolutionJob.id, job.id));
    }
  }

  return { processed: jobs.length, resolved, skipped, failed };
}

export async function enqueueTreeForResolution(input: {
  treeId: string;
  items: TreeItem[];
}): Promise<void> {
  await Promise.allSettled(
    input.items.map((item) => enqueueEntityResolutionJob({ treeId: input.treeId, item })),
  );
}

export function kickEntityResolutionRunner(): void {
  void processEntityResolutionJobs({ limit: ENTITY_RESOLVER_BATCH_LIMIT }).catch((error) => {
    console.error("Entity resolution runner failed", error);
  });
}

export async function getResolvedEntitiesForTree(input: {
  treeId: string;
  currentUserId?: string;
}): Promise<TreeResolvedEntitiesMap> {
  const links = await db
    .select({
      itemId: treeItemEntity.itemId,
      entityId: entity.id,
      type: entity.type,
      name: entity.name,
      creatorName: entity.creatorName,
      creatorRole: entity.creatorRole,
      disambiguation: entity.disambiguation,
      year: entity.year,
      imageUrl: entity.imageUrl,
      description: entity.description,
    })
    .from(treeItemEntity)
    .innerJoin(entity, eq(entity.id, treeItemEntity.entityId))
    .where(eq(treeItemEntity.treeId, input.treeId));

  if (links.length === 0) {
    return {};
  }

  const entityIds = links.map((link) => link.entityId);
  const countRows = await db
    .select({ entityId: entityLike.entityId, value: count() })
    .from(entityLike)
    .where(inArray(entityLike.entityId, entityIds))
    .groupBy(entityLike.entityId);
  const countMap = new Map(countRows.map((row) => [row.entityId, row.value]));
  const appearanceRows = await db
    .select({
      entityId: treeItemEntity.entityId,
      value: sql<number>`count(distinct ${treeItemEntity.treeId})::int`,
    })
    .from(treeItemEntity)
    .where(inArray(treeItemEntity.entityId, entityIds))
    .groupBy(treeItemEntity.entityId);
  const appearanceMap = new Map(appearanceRows.map((row) => [row.entityId, row.value]));

  const likedRows = input.currentUserId
    ? await db
        .select({ entityId: entityLike.entityId })
        .from(entityLike)
        .where(
          and(eq(entityLike.userId, input.currentUserId), inArray(entityLike.entityId, entityIds)),
        )
    : [];
  const likedSet = new Set(likedRows.map((row) => row.entityId));

  return Object.fromEntries(
    links.map((link) => [
      link.itemId,
      {
        id: link.entityId,
        type: link.type,
        name: link.name,
        creatorName: link.creatorName,
        creatorRole: link.creatorRole,
        disambiguation: link.disambiguation,
        year: link.year,
        imageUrl: link.imageUrl,
        description: link.description,
        likeCount: countMap.get(link.entityId) ?? 0,
        appearanceCount: appearanceMap.get(link.entityId) ?? 0,
        likedByCurrentUser: likedSet.has(link.entityId),
      },
    ]),
  );
}

export async function likeEntity(input: {
  userId: string;
  entityId: string;
}): Promise<{ liked: true; likeCount: number }> {
  const [row] = await db
    .select({ id: entity.id })
    .from(entity)
    .where(eq(entity.id, input.entityId))
    .limit(1);
  if (!row) {
    throw new Error("Thing not found");
  }
  await db
    .insert(entityLike)
    .values({ id: nanoid(), userId: input.userId, entityId: input.entityId })
    .onConflictDoNothing({ target: [entityLike.userId, entityLike.entityId] });
  const [countRow] = await db
    .select({ value: count() })
    .from(entityLike)
    .where(eq(entityLike.entityId, input.entityId));
  return { liked: true as const, likeCount: countRow?.value ?? 0 };
}

export async function unlikeEntity(input: {
  userId: string;
  entityId: string;
}): Promise<{ liked: false; likeCount: number }> {
  await db
    .delete(entityLike)
    .where(and(eq(entityLike.userId, input.userId), eq(entityLike.entityId, input.entityId)));
  const [countRow] = await db
    .select({ value: count() })
    .from(entityLike)
    .where(eq(entityLike.entityId, input.entityId));
  return { liked: false as const, likeCount: countRow?.value ?? 0 };
}

export async function listLikedEntitiesForUser(
  userId: string | undefined,
): Promise<{ entities: ResolvedEntitySummary[] }> {
  if (!userId) {
    return { entities: [] as ResolvedEntitySummary[] };
  }
  const rows = await db
    .select({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      creatorName: entity.creatorName,
      creatorRole: entity.creatorRole,
      disambiguation: entity.disambiguation,
      year: entity.year,
      imageUrl: entity.imageUrl,
      description: entity.description,
      createdAt: entityLike.createdAt,
    })
    .from(entityLike)
    .innerJoin(entity, eq(entity.id, entityLike.entityId))
    .where(eq(entityLike.userId, userId))
    .orderBy(desc(entityLike.createdAt));

  const entityIds = rows.map((row) => row.id);
  const countRows =
    entityIds.length > 0
      ? await db
          .select({ entityId: entityLike.entityId, value: count() })
          .from(entityLike)
          .where(inArray(entityLike.entityId, entityIds))
          .groupBy(entityLike.entityId)
      : [];
  const countMap = new Map(countRows.map((row) => [row.entityId, row.value]));
  const appearanceRows =
    entityIds.length > 0
      ? await db
          .select({
            entityId: treeItemEntity.entityId,
            value: sql<number>`count(distinct ${treeItemEntity.treeId})::int`,
          })
          .from(treeItemEntity)
          .where(inArray(treeItemEntity.entityId, entityIds))
          .groupBy(treeItemEntity.entityId)
      : [];
  const appearanceMap = new Map(appearanceRows.map((row) => [row.entityId, row.value]));

  return {
    entities: rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      creatorName: row.creatorName,
      creatorRole: row.creatorRole,
      disambiguation: row.disambiguation,
      year: row.year,
      imageUrl: row.imageUrl,
      description: row.description,
      likeCount: countMap.get(row.id) ?? 0,
      appearanceCount: appearanceMap.get(row.id) ?? 0,
      likedByCurrentUser: true,
    })),
  };
}

export async function backfillEntityResolutionJobs(): Promise<{
  scanned: number;
  enqueued: number;
  processed: number;
  resolved: number;
  skipped: number;
  failed: number;
}> {
  const rows = await db.select({ id: cultureTree.id, data: cultureTree.data }).from(cultureTree);
  let scanned = 0;
  let enqueued = 0;
  for (const row of rows) {
    const parsed = CultureTreeSchema.safeParse(row.data);
    if (!parsed.success) {
      continue;
    }
    scanned += parsed.data.items.length;
    const before = await db
      .select({ id: entityResolutionJob.id })
      .from(entityResolutionJob)
      .where(eq(entityResolutionJob.treeId, row.id));
    await enqueueTreeForResolution({ treeId: row.id, items: parsed.data.items });
    const after = await db
      .select({ id: entityResolutionJob.id })
      .from(entityResolutionJob)
      .where(eq(entityResolutionJob.treeId, row.id));
    enqueued += Math.max(0, after.length - before.length);
  }
  const result = await processEntityResolutionJobs({ limit: 25 });
  return { scanned, enqueued, ...result };
}

export async function backfillMusicBrainzAlbumImages(): Promise<{
  scanned: number;
  updated: number;
  missing: number;
}> {
  const rows = await db
    .select({
      id: entity.id,
      releaseGroupMbid: entity.primaryExternalId,
    })
    .from(entity)
    .where(
      and(
        eq(entity.type, "album"),
        eq(entity.primaryExternalSource, "musicbrainz"),
        eq(entity.primaryExternalType, "release-group"),
        sql`${entity.imageUrl} is null`,
      ),
    );

  let updated = 0;
  let missing = 0;
  for (const row of rows) {
    const imageUrl = await fetchReleaseGroupCoverArt(row.releaseGroupMbid);
    if (!imageUrl) {
      missing += 1;
      continue;
    }
    await db.update(entity).set({ imageUrl }).where(eq(entity.id, row.id));
    updated += 1;
  }

  return { scanned: rows.length, updated, missing };
}
