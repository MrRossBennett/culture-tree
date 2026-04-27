import type { ImageProvenance } from "@repo/schemas";

export type EntityMetadata = Record<string, unknown> & {
  imageProvenance?: ImageProvenance;
};

export function compactMetadata(metadata: Record<string, unknown> | undefined): EntityMetadata {
  if (!metadata) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as EntityMetadata;
}

export function mergeEntityMetadata(
  existing: unknown,
  incoming: Record<string, unknown> | undefined,
): EntityMetadata | undefined {
  const existingMetadata =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  const next = {
    ...existingMetadata,
    ...compactMetadata(incoming),
  } as EntityMetadata;

  if (!incoming || !("imageProvenance" in incoming)) {
    const existingImageProvenance = (existingMetadata as EntityMetadata).imageProvenance;
    if (existingImageProvenance) {
      next.imageProvenance = existingImageProvenance;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
