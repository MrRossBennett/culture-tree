import { z } from "zod";

export const EnrichedMediaSchema = z.object({
  coverUrl: z.url().optional(),
  thumbnailUrl: z.url().optional(),

  externalUrl: z.url().optional(),
  spotifyUrl: z.url().optional(),
  spotifyPreviewUrl: z.url().optional(),
  youtubeVideoId: z.string().optional(),
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
});

export type EnrichedMedia = z.infer<typeof EnrichedMediaSchema>;
