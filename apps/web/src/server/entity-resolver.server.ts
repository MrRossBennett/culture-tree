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
  WD,
  buildWikidataCover,
  classifyWikidataType,
  claimString,
  creatorHintFromDescription,
  fetchWikidataEntities,
  searchWikidataEntities,
  yearFromClaims,
  type WikidataEntity,
} from "@repo/engine";
import {
  buildImageProvenance,
  CultureTreeSchema,
  inferImageProvenanceFromUrl,
  TreeItemSchema,
  type EnrichedMedia,
  type ExternalNodeSourceValue,
  type ImageProvenance,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { and, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { TreeSummaryCardData } from "~/components/tree-summary-card";

import { compactMetadata, mergeEntityMetadata, type EntityMetadata } from "./entity-metadata";
import {
  primarySourceForType,
  sourceCanCreateEntityForType,
  wikipediaFallbackTypes,
} from "./entity-resolution-authorities";
import { buildTreeSummaryCardData } from "./tree-summary.server";

const ENTITY_RESOLVER_BATCH_LIMIT = 5;
const ENTITY_RESOLVER_KICK_MAX_JOBS = 25;
const MAX_JOB_ATTEMPTS = 3;
const COVER_ART_ARCHIVE_BASE = "https://coverartarchive.org";
const TMDB_BASE = "https://api.themoviedb.org/3";

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
  /** Public trees—other than the one being viewed—that this branch also appears in. */
  appearsInTrees: TreeSummaryCardData[];
  /** Count of other private trees this branch appears in (no card shown). */
  privateAppearanceCount: number;
  likedByCurrentUser: boolean;
};

export type TreeResolvedEntitiesMap = Record<string, ResolvedEntitySummary>;

type ResolverCandidate = EntityDisplayInput & ExternalIdentityInput;

type ResolutionResult =
  | { status: "resolved"; entityId: string }
  | { status: "skipped"; reason: string };

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

function imageKindForNode(
  type: NodeTypeValue,
): "poster" | "cover" | "portrait" | "photo" | "lead-image" {
  if (type === "film" || type === "tv") {
    return "poster";
  }
  if (type === "book" || type === "album") {
    return "cover";
  }
  if (type === "person" || type === "artist") {
    return "portrait";
  }
  if (type === "place") {
    return "photo";
  }
  return "lead-image";
}

function provenanceForKnownImage(input: {
  item: TreeItem;
  media?: EnrichedMedia;
  imageUrl?: string;
  externalUrl?: string;
}): ImageProvenance | undefined {
  if (!input.imageUrl) {
    return undefined;
  }

  const source = input.item.identity?.source;
  if (source === "tmdb") {
    return buildImageProvenance({
      source: "tmdb",
      kind: "poster",
      remoteUrl: input.imageUrl,
      attributionUrl: input.externalUrl,
      checkedAt: new Date(),
    });
  }
  if (source === "wikipedia") {
    return buildImageProvenance({
      source: "wikipedia",
      kind: imageKindForNode(input.item.type),
      remoteUrl: input.imageUrl,
      attributionUrl: input.externalUrl ?? input.media?.wikipediaUrl,
      checkedAt: new Date(),
    });
  }

  return inferImageProvenanceFromUrl({
    remoteUrl: input.imageUrl,
    attributionUrl: input.externalUrl ?? input.media?.externalUrl ?? input.media?.wikipediaUrl,
    checkedAt: new Date(),
  });
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
    if (kind === "person" && id?.trim()) {
      return {
        source: "tmdb",
        externalType: "person",
        externalId: id.trim(),
        externalUrl: `https://www.themoviedb.org/person/${id.trim()}`,
      };
    }
    return null;
  }

  if (identity.source === "wikidata") {
    return {
      source: "wikidata",
      externalType: "item",
      externalId: identity.externalId,
      externalUrl: `https://www.wikidata.org/wiki/${identity.externalId}`,
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
      const externalUrl = `https://www.themoviedb.org/${tmdbType}/${media.externalId.trim()}`;
      const display = displayFromItem(item, media, externalUrl);
      return {
        source: "tmdb",
        externalType: tmdbType,
        externalId: media.externalId.trim(),
        externalUrl,
        ...display,
      };
    }
    const musicBrainzExternalType = musicBrainzExternalTypeForNode(item.type);
    if (musicBrainzExternalType && media?.externalId?.trim()) {
      const externalUrl = musicBrainzUrlForNode(item.type, media.externalId.trim());
      const display = displayFromItem(item, media, externalUrl);
      return {
        source: "musicbrainz",
        externalType: musicBrainzExternalType,
        externalId: media.externalId.trim(),
        externalUrl,
        ...display,
      };
    }
    const wikipediaSlug = media?.wikipediaUrl ? normalizeWikipediaKey(media.wikipediaUrl) : null;
    if (wikipediaSlug && wikipediaFallbackTypes().has(item.type)) {
      const display = displayFromItem(item, media, media?.wikipediaUrl);
      return {
        source: "wikipedia",
        externalType: "page",
        externalId: wikipediaSlug,
        externalUrl: media?.wikipediaUrl,
        ...display,
      };
    }
    return null;
  }

  return {
    ...identity,
    ...displayFromItem(item, media, identity.externalUrl),
  };
}

function displayFromItem(
  item: TreeItem,
  media: EnrichedMedia | undefined,
  externalUrl?: string,
): EntityDisplayInput {
  const year = item.snapshot?.year ?? item.year;
  const creatorName = item.searchHint.creator?.trim() || undefined;
  const imageUrl = item.snapshot?.image ?? media?.coverUrl ?? media?.thumbnailUrl;
  const imageProvenance = provenanceForKnownImage({ item, media, imageUrl, externalUrl });
  return {
    type: item.type,
    name: canonicalNameFromItem(item),
    creatorName,
    creatorRole: creatorName ? creatorRoleForType(item.type) : undefined,
    disambiguation: disambiguationFor(item.type, year),
    year,
    imageUrl,
    description: media?.description ?? media?.wikiExtract,
    metadata: compactMetadata({ searchHint: item.searchHint, imageProvenance }),
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
    .select({ entityId: entityExternalIdentity.entityId, metadata: entity.metadata })
    .from(entityExternalIdentity)
    .innerJoin(entity, eq(entity.id, entityExternalIdentity.entityId))
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
        metadata: mergeEntityMetadata(existingIdentity.metadata, input.metadata),
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
      metadata: mergeEntityMetadata(undefined, input.metadata),
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

async function resolveKnownIdentity(input: {
  treeId: string;
  item: TreeItem;
  media?: EnrichedMedia;
}): Promise<ResolutionResult | null> {
  // A staged Wikidata search result resolves by fetching its QID — the canonical record (and
  // its notability) comes from Wikidata, not from the possibly-thin snapshot, keeping one
  // authoritative entity per work. Specialist identities (TMDB/MusicBrainz from creator
  // expansion) still mint from the snapshot via candidateFromKnownIdentity below.
  const candidate =
    input.item.identity?.source === "wikidata"
      ? await resolveWikidataByQid(input.item, input.item.identity.externalId)
      : candidateFromKnownIdentity(input.item, input.media);
  if (!candidate) {
    return null;
  }
  if (!sourceCanCreateEntityForType(candidate.source, input.item.type)) {
    return { status: "skipped", reason: "source-not-primary-for-type" };
  }
  return resolveWithCandidate({ treeId: input.treeId, item: input.item, candidate });
}

// A film/TV poster fetched by its TMDB id (read from Wikidata P4947/P4983). TMDB exposes no
// constructible poster URL, so this single call is the only way to the real artwork at mint
// time; the Wikidata Commons image (P18) is the fallback when it's unavailable.
async function fetchTmdbPosterById(
  mediaType: "movie" | "tv",
  id: string,
): Promise<string | undefined> {
  if (!hasTmdbCredentials()) {
    return undefined;
  }
  const url = new URL(`${TMDB_BASE}/${mediaType}/${id}`);
  try {
    const response = await fetch(url, tmdbFetchInit(url));
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as { poster_path?: string | null };
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : undefined;
  } catch {
    return undefined;
  }
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

// Build a canonical resolver candidate from a Wikidata entity. The QID is the primary identity;
// the cover prefers what search already resolved (item.snapshot.image), else is constructed,
// with a real TMDB poster fetched for film/TV. The sitelink count is persisted as the
// notability breadcrumb (read live by search; stored here for future work-page ranking).
async function wikidataEntityToCandidate(
  item: TreeItem,
  entity: WikidataEntity,
): Promise<ResolverCandidate> {
  const type = item.type;
  const name = entity.label ?? item.snapshot?.name ?? item.name;
  const year = yearFromClaims(entity.claims) ?? item.snapshot?.year ?? item.year;
  const creatorName =
    item.searchHint.creator?.trim() || creatorHintFromDescription(entity.description);

  let imageUrl = item.snapshot?.image ?? buildWikidataCover(entity, type);
  if (!item.snapshot?.image && (type === "film" || type === "tv")) {
    const tmdbId = claimString(entity.claims, type === "film" ? WD.tmdbMovieId : WD.tmdbTvId);
    if (tmdbId) {
      const poster = await fetchTmdbPosterById(type === "film" ? "movie" : "tv", tmdbId);
      if (poster) {
        imageUrl = poster;
      }
    }
  }

  const externalUrl = `https://www.wikidata.org/wiki/${entity.id}`;
  const imageProvenance = imageUrl
    ? inferImageProvenanceFromUrl({
        remoteUrl: imageUrl,
        attributionUrl: externalUrl,
        checkedAt: new Date(),
      })
    : undefined;

  return {
    source: "wikidata",
    externalType: "item",
    externalId: entity.id,
    externalUrl,
    type,
    name,
    creatorName,
    creatorRole: creatorName ? creatorRoleForType(type) : undefined,
    disambiguation: disambiguationFor(type, year),
    year,
    imageUrl,
    description: entity.description,
    metadata: compactMetadata({
      searchHint: item.searchHint,
      imageProvenance,
      notability: entity.sitelinks,
    }),
  };
}

// Resolve an item that already carries a Wikidata identity (a staged search result) by its QID.
async function resolveWikidataByQid(
  item: TreeItem,
  qid: string,
): Promise<ResolverCandidate | null> {
  const [entity] = await fetchWikidataEntities([qid]);
  if (!entity?.label) {
    return null;
  }
  return wikidataEntityToCandidate(item, entity);
}

// Resolve an identity-less item (e.g. an AI-generated branch) by finding the most notable
// Wikidata entity of the item's type for its title — the unified find-or-mint authority that
// replaced the per-medium TMDB/MusicBrainz/Google Books/Wikipedia title searches.
async function resolveWikidata(item: TreeItem): Promise<ResolverCandidate | null> {
  const query = item.searchHint.title || item.name;
  if (!query.trim()) {
    return null;
  }
  const qids = await searchWikidataEntities(query);
  const entities = await fetchWikidataEntities(qids);
  const match = entities
    .filter((entity) => entity.label && classifyWikidataType(entity) === item.type)
    .sort((left, right) => right.sitelinks - left.sitelinks)[0];
  if (!match) {
    return null;
  }
  return wikidataEntityToCandidate(item, match);
}

async function resolveViaPrimaryAuthority(item: TreeItem): Promise<ResolverCandidate | null> {
  const cached = await getCachedResolverCandidate(item);
  if (cached) {
    return cached;
  }
  const candidate = await resolveWikidata(item);
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
  void (async () => {
    let processed = 0;
    while (processed < ENTITY_RESOLVER_KICK_MAX_JOBS) {
      const result = await processEntityResolutionJobs({ limit: ENTITY_RESOLVER_BATCH_LIMIT });
      processed += result.processed;
      if (result.processed < ENTITY_RESOLVER_BATCH_LIMIT) {
        return;
      }
    }
  })().catch((error) => {
    console.error("Entity resolution runner failed", error);
  });
}

/**
 * Of the user's own trees, which already contain the same entity as the given
 * branch. Used to mark trees as "already added" in the save-to-tree panel.
 * Best-effort: an unresolved branch (no linked entity) yields no matches.
 */
export async function listTreeIdsContainingBranch(input: {
  userId: string;
  sourceTreeId: string;
  sourceBranchId: string;
}): Promise<{ treeIds: string[] }> {
  const [link] = await db
    .select({ entityId: treeItemEntity.entityId })
    .from(treeItemEntity)
    .where(
      and(
        eq(treeItemEntity.treeId, input.sourceTreeId),
        eq(treeItemEntity.itemId, input.sourceBranchId),
      ),
    )
    .limit(1);
  if (!link) {
    return { treeIds: [] };
  }
  const rows = await db
    .select({ treeId: treeItemEntity.treeId })
    .from(treeItemEntity)
    .innerJoin(cultureTree, eq(cultureTree.id, treeItemEntity.treeId))
    .where(and(eq(treeItemEntity.entityId, link.entityId), eq(cultureTree.userId, input.userId)));
  return { treeIds: [...new Set(rows.map((row) => row.treeId))] };
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

  // Other trees each branch appears in: public ones become summary cards, private
  // ones are tallied so the modal can say "and in N private trees". Bucket first
  // from a lightweight query, then load full card data only for the public trees.
  const otherAppearances = await db
    .select({
      entityId: treeItemEntity.entityId,
      treeId: cultureTree.id,
      isPublic: cultureTree.isPublic,
    })
    .from(treeItemEntity)
    .innerJoin(cultureTree, eq(cultureTree.id, treeItemEntity.treeId))
    .where(
      and(inArray(treeItemEntity.entityId, entityIds), ne(treeItemEntity.treeId, input.treeId)),
    );

  const appearancesByEntity = new Map<
    string,
    { publicTreeIds: string[]; privateCount: number; seenTreeIds: Set<string> }
  >();
  const publicTreeIds = new Set<string>();
  for (const row of otherAppearances) {
    let bucket = appearancesByEntity.get(row.entityId);
    if (!bucket) {
      bucket = { publicTreeIds: [], privateCount: 0, seenTreeIds: new Set() };
      appearancesByEntity.set(row.entityId, bucket);
    }
    // A branch can link to the same tree via more than one item; count each tree once.
    if (bucket.seenTreeIds.has(row.treeId)) {
      continue;
    }
    bucket.seenTreeIds.add(row.treeId);
    if (row.isPublic) {
      bucket.publicTreeIds.push(row.treeId);
      publicTreeIds.add(row.treeId);
    } else {
      bucket.privateCount += 1;
    }
  }

  const cardRows =
    publicTreeIds.size > 0
      ? await db
          .select({
            id: cultureTree.id,
            seedQuery: cultureTree.seedQuery,
            data: cultureTree.data,
            enrichmentData: cultureTree.enrichmentData,
            createdAt: cultureTree.createdAt,
            isPublic: cultureTree.isPublic,
            generationStatus: cultureTree.generationStatus,
            generationRunId: cultureTree.generationRunId,
            generationStage: cultureTree.generationStage,
            generationUpdatedAt: cultureTree.generationUpdatedAt,
            generationError: cultureTree.generationError,
            generationFinalData: cultureTree.generationFinalData,
          })
          .from(cultureTree)
          .where(inArray(cultureTree.id, [...publicTreeIds]))
      : [];
  const cardByTreeId = new Map(cardRows.map((row) => [row.id, buildTreeSummaryCardData(row)]));

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
        appearsInTrees: (appearancesByEntity.get(link.entityId)?.publicTreeIds ?? [])
          .map((treeId) => cardByTreeId.get(treeId))
          .filter((card): card is TreeSummaryCardData => card != null),
        privateAppearanceCount: appearancesByEntity.get(link.entityId)?.privateCount ?? 0,
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
      appearsInTrees: [],
      privateAppearanceCount: 0,
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
      metadata: entity.metadata,
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
    const imageProvenance = buildImageProvenance({
      source: "cover-art-archive",
      kind: "cover",
      remoteUrl: imageUrl,
      attributionUrl: musicBrainzUrlForNode("album", row.releaseGroupMbid),
      checkedAt: new Date(),
    });
    await db
      .update(entity)
      .set({
        imageUrl,
        metadata: mergeEntityMetadata(row.metadata, { imageProvenance }),
      })
      .where(eq(entity.id, row.id));
    updated += 1;
  }

  return { scanned: rows.length, updated, missing };
}

export async function backfillEntityImageProvenance(): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  const rows = await db
    .select({
      id: entity.id,
      imageUrl: entity.imageUrl,
      metadata: entity.metadata,
      primaryExternalSource: entity.primaryExternalSource,
      primaryExternalType: entity.primaryExternalType,
      primaryExternalId: entity.primaryExternalId,
    })
    .from(entity)
    .where(sql`${entity.imageUrl} is not null`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const existing = row.metadata as EntityMetadata | null;
    if (existing?.imageProvenance) {
      skipped += 1;
      continue;
    }

    const attributionUrl =
      row.primaryExternalSource === "tmdb"
        ? `https://www.themoviedb.org/${row.primaryExternalType}/${row.primaryExternalId}`
        : row.primaryExternalSource === "wikidata"
          ? `https://www.wikidata.org/wiki/${row.primaryExternalId}`
          : row.primaryExternalSource === "wikipedia"
            ? `https://en.wikipedia.org/wiki/${encodeURIComponent(row.primaryExternalId)}`
            : row.primaryExternalSource === "musicbrainz"
              ? `https://musicbrainz.org/${row.primaryExternalType}/${row.primaryExternalId}`
              : undefined;

    const imageProvenance = inferImageProvenanceFromUrl({
      remoteUrl: row.imageUrl,
      attributionUrl,
      checkedAt: new Date(),
    });

    if (!imageProvenance) {
      skipped += 1;
      continue;
    }

    await db
      .update(entity)
      .set({ metadata: mergeEntityMetadata(row.metadata, { imageProvenance }) })
      .where(eq(entity.id, row.id));
    updated += 1;
  }

  return { scanned: rows.length, updated, skipped };
}
