import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { TreeSummaryCardData } from "~/components/tree-summary-card";

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
  appearsInTrees: TreeSummaryCardData[];
  privateAppearanceCount: number;
  likedByCurrentUser: boolean;
};

export type TreeResolvedEntitiesMap = Record<string, ResolvedEntitySummary>;

const EntityLikeInputSchema = z.object({ entityId: z.string().min(1) });
const AddLikedEntityToTreeInputSchema = z.object({
  entityId: z.string().min(1),
  targetTreeId: z.string().min(1),
});
const TreeMembershipInputSchema = z.object({
  sourceTreeId: z.string().min(1),
  sourceBranchId: z.string().min(1),
});

export const $listTreesContainingBranch = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(TreeMembershipInputSchema)
  .handler(async ({ data, context }) => {
    const { listTreeIdsContainingBranch } = await import("./entity-resolver.server");
    return listTreeIdsContainingBranch({
      userId: context.user.id,
      sourceTreeId: data.sourceTreeId,
      sourceBranchId: data.sourceBranchId,
    });
  });

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

export const $addLikedEntityToTree = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(AddLikedEntityToTreeInputSchema)
  .handler(async ({ data, context }) => {
    const { addLikedBranchToTree } = await import("./liked-branch-add-to-tree");
    await addLikedBranchToTree({
      entityId: data.entityId,
      targetTreeId: data.targetTreeId,
      person: context.user,
    });
    return { ok: true as const };
  });
