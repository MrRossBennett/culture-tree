import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const EntityLikeInputSchema = z.object({ entityId: z.string().min(1) });

export const $likeEntity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(EntityLikeInputSchema)
  .handler(async ({ data, context }) => {
    const { likeEntity } = await import("./entity-resolver.server");
    return likeEntity({ userId: context.user.id, entityId: data.entityId });
  });

export const $unlikeEntity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(EntityLikeInputSchema)
  .handler(async ({ data, context }) => {
    const { unlikeEntity } = await import("./entity-resolver.server");
    return unlikeEntity({ userId: context.user.id, entityId: data.entityId });
  });

export const $listMyLikedEntities = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listLikedEntitiesForUser } = await import("./entity-resolver.server");
    return listLikedEntitiesForUser(context.user.id);
  });
