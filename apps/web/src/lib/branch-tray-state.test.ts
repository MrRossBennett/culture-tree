import type { ExternalNodeSearchResult } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  branchTraySubmitLabel,
  canSubmitBranchTray,
  clearBranchTray,
  removeBranchTrayItem,
  stageSearchResult,
  submitInputFromBranchTray,
} from "./branch-tray-state";

const leSamourai: ExternalNodeSearchResult = {
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  snapshot: {
    name: "Le Samourai",
    type: "film",
    year: 1967,
    image: "https://example.com/le-samourai.jpg",
  },
  searchHint: { title: "Le Samourai" },
  externalUrl: "https://example.com/le-samourai",
};

describe("Branch Tray state", () => {
  it("stages a searched Branch for review before submit", () => {
    const tray = stageSearchResult({ tray: [], result: leSamourai });

    expect(tray).toHaveLength(1);
    expect(tray[0]).toMatchObject({
      result: leSamourai,
      source: "manual",
    });
    expect(branchTraySubmitLabel(tray)).toBe("Add Branch");
    expect(canSubmitBranchTray(tray)).toBe(true);
  });

  it("removes a staged Branch from the tray", () => {
    const [item] = stageSearchResult({ tray: [], result: leSamourai });

    expect(removeBranchTrayItem({ tray: [item], itemId: item.id })).toEqual([]);
  });

  it("clears temporary tray state when the modal closes", () => {
    const tray = stageSearchResult({ tray: [], result: leSamourai });

    expect(clearBranchTray(tray)).toEqual([]);
  });

  it("builds the single Branch Add to Tree submit input", () => {
    const tray = stageSearchResult({ tray: [], result: leSamourai });

    expect(submitInputFromBranchTray(tray)).toEqual({
      kind: "search-result",
      result: leSamourai,
      connectionType: "thematic",
      reason: "",
    });
  });

  it("does not build submit input for an empty tray", () => {
    expect(branchTraySubmitLabel([])).toBe("Add Branches");
    expect(canSubmitBranchTray([])).toBe(false);
    expect(submitInputFromBranchTray([])).toBeNull();
  });
});
