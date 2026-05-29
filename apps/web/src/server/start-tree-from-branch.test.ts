import { CultureTreeSchema, type CultureTree, type TreeItem } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import { StartTreeFromBranchInputSchema, titleForTreeFromBranch } from "./generate-culture-tree";

const branch: TreeItem = {
  id: "branch_1",
  name: "Le Samourai",
  type: "film",
  year: 1967,
  reason: "A clean line of ritual, solitude, and professional cool.",
  connectionType: "thematic",
  branchRole: "essential-next",
  searchHint: { title: "Le Samourai" },
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  snapshot: { name: "Le Samourai", type: "film", year: 1967 },
  source: "ai",
};

const sourceTree: CultureTree = CultureTreeSchema.parse({
  title: "Noir rituals",
  items: [branch],
});

describe("Start Tree from a Branch", () => {
  it("validates the source tree and branch identifiers", () => {
    expect(
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
      }),
    ).toEqual({ sourceTreeId: "tree_1", sourceBranchId: "branch_1" });

    expect(() =>
      StartTreeFromBranchInputSchema.parse({ sourceTreeId: "", sourceBranchId: "branch_1" }),
    ).toThrow();
  });

  it("accepts an optional, trimmed title override", () => {
    expect(
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
        title: "  Late-night noir  ",
      }),
    ).toMatchObject({ title: "Late-night noir" });

    expect(
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
      }).title,
    ).toBeUndefined();

    expect(() =>
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
        title: "   ",
      }),
    ).toThrow();
  });

  it("accepts an optional, trimmed description and drops blank ones", () => {
    expect(
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
        description: "  A line of ritual and solitude.  ",
      }),
    ).toMatchObject({ description: "A line of ritual and solitude." });

    expect(
      StartTreeFromBranchInputSchema.parse({
        sourceTreeId: "tree_1",
        sourceBranchId: "branch_1",
        description: "   ",
      }).description,
    ).toBeUndefined();
  });

  it("titles the new tree after the source branch", () => {
    expect(titleForTreeFromBranch({ tree: sourceTree, branchId: "branch_1" })).toBe("Le Samourai");
  });

  it("falls back to a generic title when the branch name is blank", () => {
    // The schema forbids blank names, so bypass it to exercise the defensive fallback.
    const blankNameTree = { ...sourceTree, items: [{ ...branch, name: "   " }] } as CultureTree;
    expect(titleForTreeFromBranch({ tree: blankNameTree, branchId: "branch_1" })).toBe("New tree");
  });

  it("throws when the branch is not in the source tree", () => {
    expect(() => titleForTreeFromBranch({ tree: sourceTree, branchId: "missing" })).toThrow(
      "Branch not found",
    );
  });
});
