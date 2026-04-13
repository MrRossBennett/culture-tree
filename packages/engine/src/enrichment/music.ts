/**
 * MusicBrainz + Cover Art Archive — album lookup only for now.
 * Song enrichment uses Wikipedia only (`fetchWikipediaSongEnrichment` in `./wikipedia`).
 * Re-enable MB for songs later by wiring a combined enricher in `pipeline.ts`.
 */
import type { EnrichedMedia, TreeNode } from "@repo/schemas";

const MB_BASE = "https://musicbrainz.org/ws/2";
const COVER_BASE = "https://coverartarchive.org/release";

const DEFAULT_UA = "CultureTree/0.1 (https://github.com/culture-tree; enrichment@local)";

let mbTail: Promise<unknown> = Promise.resolve();

function mbUserAgent(): string {
  return process.env.MUSICBRAINZ_USER_AGENT?.trim() || DEFAULT_UA;
}

/** MusicBrainz asks for ≤1 req/s per app; serialize calls. */
async function mbFetch(url: string): Promise<Response> {
  const run = mbTail.then(async () => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": mbUserAgent(),
      },
    });
    await new Promise<void>((r) => setTimeout(r, 1100));
    return res;
  });
  mbTail = run.catch(() => {});
  return run as Promise<Response>;
}

function luceneTerm(field: string, value: string): string {
  const v = value.replaceAll('"', '\\"');
  return `${field}:"${v}"`;
}

type MbReleaseSearch = {
  releases?: Array<{ id?: string; title?: string }>;
};

async function coverForReleaseMbid(mbid: string): Promise<string | undefined> {
  const head = await fetch(`${COVER_BASE}/${mbid}/front-250`, { method: "HEAD" });
  if (head.ok) {
    return `${COVER_BASE}/${mbid}/front-250`;
  }
  return undefined;
}

/** Optional: swap album enricher in `pipeline.ts` to this for MB + Cover Art Archive. */
export async function fetchAlbumEnrichment(node: TreeNode): Promise<EnrichedMedia> {
  const { title, creator } = node.searchHint;
  const parts = [luceneTerm("release", title)];
  if (creator?.trim()) {
    parts.push(luceneTerm("artist", creator.trim()));
  }
  const query = parts.join(" AND ");
  const url = `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const res = await mbFetch(url);
  if (!res.ok) {
    return {};
  }
  const data = (await res.json()) as MbReleaseSearch;
  const release = data.releases?.[0];
  if (!release?.id) {
    return {};
  }
  const mbid = release.id;
  const coverUrl = await coverForReleaseMbid(mbid);
  return {
    coverUrl,
    thumbnailUrl: coverUrl,
    externalUrl: `https://musicbrainz.org/release/${mbid}`,
    description:
      release.title && creator?.trim() ? `${release.title} — ${creator.trim()}` : release.title,
    externalId: mbid,
  };
}
