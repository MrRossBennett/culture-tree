import { z } from "zod";

export const ImageProvenanceSource = z.enum([
  "tmdb",
  "google-books",
  "wikipedia",
  "musicbrainz",
  "cover-art-archive",
  "user",
  "unknown",
]);

export const ImageProvenanceKind = z.enum([
  "poster",
  "cover",
  "thumbnail",
  "portrait",
  "photo",
  "lead-image",
  "unknown",
]);

export const ImageRightsStatus = z.enum([
  "provider-supplied",
  "public-domain",
  "user-owned",
  "unknown",
]);

export const ImageProvenanceSchema = z.object({
  source: ImageProvenanceSource,
  kind: ImageProvenanceKind,
  remoteUrl: z.url(),
  attributionUrl: z.url().optional(),
  providerAssetId: z.string().trim().min(1).optional(),
  rightsStatus: ImageRightsStatus.default("unknown"),
  checkedAt: z.iso.datetime(),
});

export type ImageProvenance = z.infer<typeof ImageProvenanceSchema>;
export type ImageProvenanceSourceValue = z.infer<typeof ImageProvenanceSource>;
export type ImageProvenanceKindValue = z.infer<typeof ImageProvenanceKind>;
export type ImageRightsStatusValue = z.infer<typeof ImageRightsStatus>;

export function buildImageProvenance(input: {
  source: ImageProvenanceSourceValue;
  kind: ImageProvenanceKindValue;
  remoteUrl?: string | null;
  attributionUrl?: string | null;
  providerAssetId?: string | null;
  rightsStatus?: ImageRightsStatusValue;
  checkedAt?: Date;
}): ImageProvenance | undefined {
  const remoteUrl = input.remoteUrl?.trim();
  if (!remoteUrl) {
    return undefined;
  }

  return ImageProvenanceSchema.parse({
    source: input.source,
    kind: input.kind,
    remoteUrl,
    attributionUrl: input.attributionUrl?.trim() || undefined,
    providerAssetId: input.providerAssetId?.trim() || undefined,
    rightsStatus: input.rightsStatus ?? "provider-supplied",
    checkedAt: (input.checkedAt ?? new Date()).toISOString(),
  });
}

export function inferImageProvenanceFromUrl(input: {
  remoteUrl?: string | null;
  attributionUrl?: string | null;
  checkedAt?: Date;
}): ImageProvenance | undefined {
  const remoteUrl = input.remoteUrl?.trim();
  if (!remoteUrl) {
    return undefined;
  }

  let hostname: string;
  try {
    hostname = new URL(remoteUrl).hostname.toLowerCase();
  } catch {
    return buildImageProvenance({
      source: "unknown",
      kind: "unknown",
      remoteUrl,
      attributionUrl: input.attributionUrl,
      rightsStatus: "unknown",
      checkedAt: input.checkedAt,
    });
  }

  if (hostname === "image.tmdb.org") {
    return buildImageProvenance({
      source: "tmdb",
      kind: "poster",
      remoteUrl,
      attributionUrl: input.attributionUrl,
      checkedAt: input.checkedAt,
    });
  }

  if (
    hostname.endsWith("googleusercontent.com") ||
    hostname.includes("googleapis.com") ||
    hostname === "books.google.com"
  ) {
    return buildImageProvenance({
      source: "google-books",
      kind: "cover",
      remoteUrl,
      attributionUrl: input.attributionUrl,
      checkedAt: input.checkedAt,
    });
  }

  if (hostname.endsWith("wikimedia.org") || hostname.endsWith("wikipedia.org")) {
    return buildImageProvenance({
      source: "wikipedia",
      kind: "lead-image",
      remoteUrl,
      attributionUrl: input.attributionUrl,
      checkedAt: input.checkedAt,
    });
  }

  if (hostname === "coverartarchive.org" || hostname.endsWith("archive.org")) {
    return buildImageProvenance({
      source: "cover-art-archive",
      kind: "cover",
      remoteUrl,
      attributionUrl: input.attributionUrl,
      checkedAt: input.checkedAt,
    });
  }

  return buildImageProvenance({
    source: "unknown",
    kind: "unknown",
    remoteUrl,
    attributionUrl: input.attributionUrl,
    rightsStatus: "unknown",
    checkedAt: input.checkedAt,
  });
}
