import { describe, expect, it } from "vite-plus/test";

import { canReadCultureTree } from "./culture-trees";

describe("Culture Tree read access", () => {
  it("allows signed-out visitors to view ready Public Trees", () => {
    expect(
      canReadCultureTree({
        currentUserId: null,
        ownerUserId: "owner_1",
        isPublic: true,
        generationStatus: "ready",
      }),
    ).toBe(true);
  });

  it("keeps Private Trees inaccessible to signed-out visitors and non-Owners", () => {
    expect(
      canReadCultureTree({
        currentUserId: null,
        ownerUserId: "owner_1",
        isPublic: false,
        generationStatus: "ready",
      }),
    ).toBe(false);

    expect(
      canReadCultureTree({
        currentUserId: "visitor_1",
        ownerUserId: "owner_1",
        isPublic: false,
        generationStatus: "ready",
      }),
    ).toBe(false);
  });

  it("allows Owners to view their own Private Trees", () => {
    expect(
      canReadCultureTree({
        currentUserId: "owner_1",
        ownerUserId: "owner_1",
        isPublic: false,
        generationStatus: "ready",
      }),
    ).toBe(true);
  });

  it("does not expose active or failed generation drafts through Public Tree links", () => {
    expect(
      canReadCultureTree({
        currentUserId: null,
        ownerUserId: "owner_1",
        isPublic: true,
        generationStatus: "revealing",
      }),
    ).toBe(false);

    expect(
      canReadCultureTree({
        currentUserId: "visitor_1",
        ownerUserId: "owner_1",
        isPublic: true,
        generationStatus: "failed",
      }),
    ).toBe(false);
  });
});
