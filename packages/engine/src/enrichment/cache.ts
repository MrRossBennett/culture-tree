import { createHash } from "node:crypto";

import { db } from "@repo/db";
import { enrichmentCache } from "@repo/db/schema";
import { EnrichedMediaSchema, type EnrichedMedia, type SearchHint } from "@repo/schemas";
import { eq } from "drizzle-orm";

import { stableStringify } from "./stable-stringify";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function enrichmentCacheKey(nodeType: string, searchHint: SearchHint): string {
  return createHash("sha256")
    .update(`${nodeType}\0${stableStringify(searchHint)}`)
    .digest("hex");
}

export async function getCachedEnrichment(
  nodeType: string,
  searchHint: SearchHint,
): Promise<EnrichedMedia | null> {
  const hash = enrichmentCacheKey(nodeType, searchHint);
  const [row] = await db
    .select({
      data: enrichmentCache.data,
      expiresAt: enrichmentCache.expiresAt,
    })
    .from(enrichmentCache)
    .where(eq(enrichmentCache.searchHintHash, hash))
    .limit(1);
  if (!row) {
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const parsed = EnrichedMediaSchema.safeParse(row.data);
  return parsed.success ? parsed.data : null;
}

export async function setCachedEnrichment(
  nodeType: string,
  searchHint: SearchHint,
  data: EnrichedMedia,
): Promise<void> {
  const hash = enrichmentCacheKey(nodeType, searchHint);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db
    .insert(enrichmentCache)
    .values({
      id: hash,
      searchHintHash: hash,
      nodeType,
      data,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: enrichmentCache.searchHintHash,
      set: {
        nodeType,
        data,
        expiresAt,
      },
    });
}
