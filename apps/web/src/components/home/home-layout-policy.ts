export type HomeSurfaceSection = "hero" | "suggestions" | "tree-library" | "start-tree";

export function homeSurfaceSections(input: { signedIn: boolean }): HomeSurfaceSection[] {
  return input.signedIn ? ["tree-library", "start-tree"] : ["hero", "start-tree", "suggestions"];
}
