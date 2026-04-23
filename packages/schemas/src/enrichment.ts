import { z } from "zod";

export const EnrichedMediaSchema = z.object({
  coverUrl: z.url().optional(),
  thumbnailUrl: z.url().optional(),

  externalUrl: z.url().optional(),
  /** Trailer ID from TMDB `videos` only — never from YouTube Data API. */
  youtubeVideoId: z.string().optional(),
  /** Watch URL built from `youtubeVideoId`; not from YouTube API. */
  youtubeUrl: z.url().optional(),
  wikipediaUrl: z.url().optional(),

  rating: z.number().optional(),
  description: z.string().optional(),
  externalId: z.string().optional(),

  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  googlePlaceId: z.string().optional(),
  placePhotos: z.array(z.url()).optional(),
  placeStatus: z.enum(["open", "closed", "historical"]).optional(),

  wikiExtract: z.string().optional(),
  eventDate: z.string().optional(),

  /** Populated for song nodes when MusicBrainz resolves a release (often the studio album). */
  musicAlbumTitle: z.string().optional(),
  musicAlbumExternalUrl: z.url().optional(),
});

export type EnrichedMedia = z.infer<typeof EnrichedMediaSchema>;

/** Per-tree enrichments keyed by tree item id. */
export const TreeEnrichmentsMapSchema = z.record(z.string(), EnrichedMediaSchema);

export type TreeEnrichmentsMap = z.infer<typeof TreeEnrichmentsMapSchema>;
