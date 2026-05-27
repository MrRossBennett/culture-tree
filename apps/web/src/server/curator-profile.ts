import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree, curatorFollow, user as authUser } from "@repo/db/schema";
import {
  countCultureTreeNodes,
  CultureTreeSchema,
  type CultureTree,
  type NodeTypeValue,
  type TreeEnrichmentsMap,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { parseTreeEnrichments } from "./committed-branch-enrichment";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";

type CuratorPerson = {
  id: string;
  email?: string | null;
};

type CuratorProfileRow = {
  id: string;
  username: string | null;
  bio: string | null;
};

export type CuratorFollowAdapters = {
  loadCuratorByUsername: (username: string) => Promise<CuratorProfileRow | null>;
  isFollowing: (input: { followerUserId: string; followedUserId: string }) => Promise<boolean>;
  countFollowers: (followedUserId: string) => Promise<number>;
  insertFollow: (input: { followerUserId: string; followedUserId: string }) => Promise<void>;
  deleteFollow: (input: { followerUserId: string; followedUserId: string }) => Promise<void>;
};

type CuratorTreePreviewItem = {
  type: NodeTypeValue;
  imageUrl?: string;
};

const CuratorUsernameInputSchema = z.object({ username: z.string().trim().min(1) });

async function loadCuratorByUsername(username: string): Promise<CuratorProfileRow | null> {
  const [row] = await db
    .select({ id: authUser.id, username: authUser.username, bio: authUser.bio })
    .from(authUser)
    .where(eq(authUser.username, username))
    .limit(1);
  return row ?? null;
}

async function isFollowing(input: {
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

async function countFollowers(followedUserId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(curatorFollow)
    .where(eq(curatorFollow.followedUserId, followedUserId))
    .limit(1);
  return row?.value ?? 0;
}

async function insertFollow(input: {
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

async function deleteFollow(input: {
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

const defaultCuratorFollowAdapters: CuratorFollowAdapters = {
  loadCuratorByUsername,
  isFollowing,
  countFollowers,
  insertFollow,
  deleteFollow,
};

export function canViewCuratorPrivateTrees(input: { viewerUserId: string; curatorUserId: string }) {
  return input.viewerUserId === input.curatorUserId;
}

function profileTreePreviewItems(
  tree: CultureTree,
  enrichments: TreeEnrichmentsMap,
): CuratorTreePreviewItem[] {
  return tree.items.slice(0, 6).map((item) => {
    const media = enrichments[item.id];
    return {
      type: item.type,
      imageUrl: media?.coverUrl ?? media?.thumbnailUrl ?? item.snapshot?.image ?? undefined,
    };
  });
}

async function listProfileTrees(input: { userId: string; includePrivate: boolean }) {
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
        nodeCount: 0,
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
      nodeCount: countCultureTreeNodes(tree),
      createdAt: row.createdAt.toISOString(),
      isPublic: row.isPublic,
      generationStatus: generation.status,
      previewItems: profileTreePreviewItems(tree, enrichments),
    };
  });
}

export async function followCurator(input: {
  username: string;
  person: CuratorPerson;
  adapters?: Partial<CuratorFollowAdapters>;
}) {
  const adapters = { ...defaultCuratorFollowAdapters, ...input.adapters };
  const curator = await adapters.loadCuratorByUsername(input.username);
  if (!curator?.username || curator.id === input.person.id) {
    throw new Error("Curator not found");
  }

  await adapters.insertFollow({
    followerUserId: input.person.id,
    followedUserId: curator.id,
  });

  return {
    isFollowing: true as const,
    followerCount: await adapters.countFollowers(curator.id),
  };
}

export async function unfollowCurator(input: {
  username: string;
  person: CuratorPerson;
  adapters?: Partial<CuratorFollowAdapters>;
}) {
  const adapters = { ...defaultCuratorFollowAdapters, ...input.adapters };
  const curator = await adapters.loadCuratorByUsername(input.username);
  if (!curator?.username || curator.id === input.person.id) {
    throw new Error("Curator not found");
  }

  await adapters.deleteFollow({
    followerUserId: input.person.id,
    followedUserId: curator.id,
  });

  return {
    isFollowing: false as const,
    followerCount: await adapters.countFollowers(curator.id),
  };
}

export const $getCuratorProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(CuratorUsernameInputSchema)
  .handler(async ({ data, context }) => {
    const curator = await loadCuratorByUsername(data.username);
    if (!curator?.username) {
      return null;
    }

    const isOwnProfile = canViewCuratorPrivateTrees({
      viewerUserId: context.user.id,
      curatorUserId: curator.id,
    });
    const [followerCount, following, trees] = await Promise.all([
      countFollowers(curator.id),
      isOwnProfile
        ? Promise.resolve(false)
        : isFollowing({
            followerUserId: context.user.id,
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
  });

export const $followCurator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(CuratorUsernameInputSchema)
  .handler(async ({ data, context }) =>
    followCurator({ username: data.username, person: context.user }),
  );

export const $unfollowCurator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(CuratorUsernameInputSchema)
  .handler(async ({ data, context }) =>
    unfollowCurator({ username: data.username, person: context.user }),
  );
