import { describe, expect, it } from "vite-plus/test";

import { homeSurfaceSections } from "./home-layout-policy";

describe("home surface layout", () => {
  it("prioritizes the curator library before Start Tree for signed-in users", () => {
    expect(homeSurfaceSections({ signedIn: true })).toEqual(["tree-library", "start-tree"]);
  });

  it("keeps the discovery prompt-first surface for signed-out visitors", () => {
    expect(homeSurfaceSections({ signedIn: false })).toEqual(["hero", "start-tree", "suggestions"]);
  });
});
