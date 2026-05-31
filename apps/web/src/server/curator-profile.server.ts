import { db } from "@repo/db";
import { cultureTree, curatorFollow, user as authUser } from "@repo/db/schema";
import {
  CultureTreeSchema,
  type CultureTree,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
} from "@repo/schemas";
import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { resolveDisplayImageUrl } from "~/lib/display-image";

import { parseTreeEnrichments } from "./committed-branch-enrichment";
import {
  canViewCuratorPrivateTrees,
  type CuratorFollowAdapters,
  type CuratorProfileRow,
} from "./curator-profile";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";

type CuratorTreePreviewItem = {
  type: NodeTypeValue;
  imageUrl?: string;
};

export async function loadCuratorByUsername(username: string): Promise<CuratorProfileRow | null> {
  const [row] = await db
    .select({ id: authUser.id, username: authUser.username, bio: authUser.bio })
    .from(authUser)
    .where(eq(authUser.username, username))
    .limit(1);
  return row ?? null;
}

export async function isFollowing(input: {
  followerUserId: string;
  followedUserId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: curatorFollow.id })
    .from(curatorFollow)
    .where(
      and(
        eq(curatorFollow.followerUserId, input.followerUserId),
        eq(curatorFollow.followedUserId, input.followedUserId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function countFollowers(followedUserId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(curatorFollow)
    .where(eq(curatorFollow.followedUserId, followedUserId))
    .limit(1);
  return row?.value ?? 0;
}

export async function insertFollow(input: {
  followerUserId: string;
  followedUserId: string;
}): Promise<void> {
  await db
    .insert(curatorFollow)
    .values({
      id: nanoid(),
      followerUserId: input.followerUserId,
      followedUserId: input.followedUserId,
    })
    .onConflictDoNothing({
      target: [curatorFollow.followerUserId, curatorFollow.followedUserId],
    });
}

export async function deleteFollow(input: {
  followerUserId: string;
  followedUserId: string;
}): Promise<void> {
  await db
    .delete(curatorFollow)
    .where(
      and(
        eq(curatorFollow.followerUserId, input.followerUserId),
        eq(curatorFollow.followedUserId, input.followedUserId),
      ),
    );
}

export const defaultCuratorFollowAdapters: CuratorFollowAdapters = {
  loadCuratorByUsername,
  isFollowing,
  countFollowers,
  insertFollow,
  deleteFollow,
};

function profileTreePreviewItems(
  tree: CultureTree,
  enrichments: TreeEnrichmentsMap,
): CuratorTreePreviewItem[] {
  return tree.items.slice(0, 6).map((item) => {
    const media = enrichments[item.id];
    return {
      type: item.type,
      imageUrl: resolveDisplayImageUrl(item, media),
    };
  });
}

export async function getCuratorProfile(input: { username: string; viewerUserId: string }) {
  const curator = await loadCuratorByUsername(input.username);
  if (!curator?.username) {
    return null;
  }

  const isOwnProfile = canViewCuratorPrivateTrees({
    viewerUserId: input.viewerUserId,
    curatorUserId: curator.id,
  });
  const [followerCount, following, trees] = await Promise.all([
    countFollowers(curator.id),
    isOwnProfile
      ? Promise.resolve(false)
      : isFollowing({
          followerUserId: input.viewerUserId,
          followedUserId: curator.id,
        }),
    listProfileTrees({ userId: curator.id, includePrivate: isOwnProfile }),
  ]);

  return {
    profile: {
      id: curator.id,
      username: curator.username,
      bio: curator.bio,
    },
    isOwnProfile,
    follow: {
      isFollowing: following,
      followerCount,
    },
    trees,
  };
}

export async function listProfileTrees(input: { userId: string; includePrivate: boolean }) {
  const rows = await db
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
    .where(
      input.includePrivate
        ? eq(cultureTree.userId, input.userId)
        : and(eq(cultureTree.userId, input.userId), eq(cultureTree.isPublic, true)),
    )
    .orderBy(desc(cultureTree.createdAt));

  return rows.map((row) => {
    const generation = parseGenerationMetadata(row);
    const parsed = CultureTreeSchema.safeParse(row.data);
    if (!parsed.success) {
      return {
        id: row.id,
        listTitle: row.seedQuery.trim() || "Untitled tree",
        branchCount: 0,
        createdAt: row.createdAt.toISOString(),
        isPublic: row.isPublic,
        generationStatus: generation.status,
        previewItems: [],
      };
    }
    const tree = parsed.data;
    const seed = tree.seed?.trim();
    const title = tree.title?.trim() || seed || row.seedQuery.trim() || "Untitled tree";
    const enrichments = parseTreeEnrichments(row.enrichmentData);
    return {
      id: row.id,
      listTitle: title,
      branchCount: tree.items.length,
      createdAt: row.createdAt.toISOString(),
      isPublic: row.isPublic,
      generationStatus: generation.status,
      previewItems: profileTreePreviewItems(tree, enrichments),
    };
  });
}
