import { describe, expect, it, vi } from "vite-plus/test";

import {
  canViewCuratorPrivateTrees,
  followCurator,
  type CuratorFollowAdapters,
  unfollowCurator,
} from "./curator-profile";

function baseAdapters(overrides: Partial<CuratorFollowAdapters> = {}): CuratorFollowAdapters {
  return {
    loadCuratorByUsername: vi.fn(async () => ({
      id: "curator_2",
      username: "ana",
      bio: "Films, records, places.",
    })),
    isFollowing: vi.fn(async () => false),
    countFollowers: vi.fn(async () => 4),
    insertFollow: vi.fn(async () => {}),
    deleteFollow: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("Follow Curator", () => {
  it("follows another curator as a person-centered relationship", async () => {
    const adapters = baseAdapters();

    const result = await followCurator({
      username: "ana",
      person: { id: "curator_1", email: "curator@example.com" },
      adapters,
    });

    expect(result).toEqual({ isFollowing: true, followerCount: 4 });
    expect(adapters.insertFollow).toHaveBeenCalledWith({
      followerUserId: "curator_1",
      followedUserId: "curator_2",
    });
  });

  it("unfollows another curator", async () => {
    const adapters = baseAdapters({ countFollowers: vi.fn(async () => 3) });

    const result = await unfollowCurator({
      username: "ana",
      person: { id: "curator_1" },
      adapters,
    });

    expect(result).toEqual({ isFollowing: false, followerCount: 3 });
    expect(adapters.deleteFollow).toHaveBeenCalledWith({
      followerUserId: "curator_1",
      followedUserId: "curator_2",
    });
  });

  it("does not allow following your own curator profile", async () => {
    const adapters = baseAdapters({
      loadCuratorByUsername: vi.fn(async () => ({
        id: "curator_1",
        username: "me",
        bio: null,
      })),
    });

    await expect(
      followCurator({
        username: "me",
        person: { id: "curator_1" },
        adapters,
      }),
    ).rejects.toThrow("Curator not found");
    expect(adapters.insertFollow).not.toHaveBeenCalled();
  });

  it("only lets curators see their own private profile trees", () => {
    expect(
      canViewCuratorPrivateTrees({
        viewerUserId: "curator_1",
        curatorUserId: "curator_1",
      }),
    ).toBe(true);
    expect(
      canViewCuratorPrivateTrees({
        viewerUserId: "curator_1",
        curatorUserId: "curator_2",
      }),
    ).toBe(false);
  });
});
