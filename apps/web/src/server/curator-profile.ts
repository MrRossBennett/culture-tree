import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type CuratorPerson = {
  id: string;
  email?: string | null;
};

export type CuratorProfileRow = {
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

const CuratorUsernameInputSchema = z.object({ username: z.string().trim().min(1) });

export function canViewCuratorPrivateTrees(input: { viewerUserId: string; curatorUserId: string }) {
  return input.viewerUserId === input.curatorUserId;
}

export async function followCurator(input: {
  username: string;
  person: CuratorPerson;
  adapters: CuratorFollowAdapters;
}) {
  const { adapters } = input;
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
  adapters: CuratorFollowAdapters;
}) {
  const { adapters } = input;
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
    const { getCuratorProfile } = await import("./curator-profile.server");
    return getCuratorProfile({ username: data.username, viewerUserId: context.user.id });
  });

export const $followCurator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(CuratorUsernameInputSchema)
  .handler(async ({ data, context }) => {
    const { defaultCuratorFollowAdapters } = await import("./curator-profile.server");
    return followCurator({
      username: data.username,
      person: context.user,
      adapters: defaultCuratorFollowAdapters,
    });
  });

export const $unfollowCurator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(CuratorUsernameInputSchema)
  .handler(async ({ data, context }) => {
    const { defaultCuratorFollowAdapters } = await import("./curator-profile.server");
    return unfollowCurator({
      username: data.username,
      person: context.user,
      adapters: defaultCuratorFollowAdapters,
    });
  });
