import type { EnrichedMedia, TreeItem } from "@repo/schemas";

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_BASE = "https://coverartarchive.org";

function userAgent(): string {
  return (
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "CultureTreeLocal/0.1 (local development; contact: ross@culturetree.local)"
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksConfident(found: string | undefined, wanted: string): boolean {
  if (!found?.trim() || !wanted.trim()) {
    return false;
  }
  const left = normalize(found);
  const right = normalize(wanted);
  return left === right || left.includes(right) || right.includes(left);
}

function albumTitleSearchVariants(title: string): string[] {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return [];
  }
  const stripped = trimmed
    .replace(/\s*[:\-–—]?\s*(original\s+motion\s+picture\s+)?(score|soundtrack|ost)\s*$/i, "")
    .trim();
  return Array.from(new Set([trimmed, stripped].filter((value) => value.length >= 3)));
}

function musicBrainzAlbumQuery(title: string, item: TreeItem): string {
  const creator = item.searchHint.creator?.trim();
  return [
    `releasegroup:"${title.replaceAll('"', "")}"`,
    creator ? `artistname:"${creator.replaceAll('"', "")}"` : "",
  ]
    .filter(Boolean)
    .join(" AND ");
}

async function fetchReleaseGroupCoverArt(
  releaseGroupMbid: string,
): Promise<{ coverUrl?: string; thumbnailUrl?: string }> {
  const response = await fetch(
    `${COVER_ART_ARCHIVE_BASE}/release-group/${encodeURIComponent(releaseGroupMbid)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
    },
  );
  if (!response.ok) {
    return {};
  }
  const data = (await response.json()) as {
    images?: Array<{
      front?: boolean;
      image?: string;
      thumbnails?: { large?: string; small?: string };
    }>;
  };
  const front = data.images?.find((image) => image.front) ?? data.images?.[0];
  return {
    coverUrl: front?.thumbnails?.large ?? front?.image,
    thumbnailUrl: front?.thumbnails?.small ?? front?.thumbnails?.large,
  };
}

export async function fetchMusicBrainzAlbumEnrichment(item: TreeItem): Promise<EnrichedMedia> {
  const titleVariants = albumTitleSearchVariants(item.searchHint.title || item.name);

  for (const title of titleVariants) {
    const url = new URL(`${MUSICBRAINZ_BASE}/release-group`);
    url.searchParams.set("query", musicBrainzAlbumQuery(title, item));
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
    });
    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as {
      "release-groups"?: Array<{
        id?: string;
        title?: string;
        "first-release-date"?: string;
      }>;
    };
    const match = data["release-groups"]?.find((row) => titleLooksConfident(row.title, title));
    if (!match?.id) {
      continue;
    }

    const cover = await fetchReleaseGroupCoverArt(match.id);
    return {
      ...cover,
      externalUrl: `https://musicbrainz.org/release-group/${match.id}`,
      externalId: match.id,
    };
  }

  return {};
}
