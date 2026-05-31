import type { ExternalNodeSearchResult } from "@repo/schemas";
import type { TreeItem } from "@repo/schemas";
import { describe, expect, it } from "vite-plus/test";

import {
  BRANCH_TRAY_MAX_ITEMS,
  branchTraySubmitLabel,
  branchTrayUnavailableReason,
  canSubmitBranchTray,
  clearBranchTray,
  removeBranchTrayItem,
  stageSuggestedResults,
  stageSearchResult,
  submitInputFromBranchTray,
  submitInputsFromBranchTray,
  type BranchTrayItem,
} from "./branch-tray-state";

const leSamourai: ExternalNodeSearchResult = {
  kind: "addable-work",
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

const theWarriors: ExternalNodeSearchResult = {
  kind: "addable-work",
  identity: { source: "wikipedia", externalId: "The_Warriors" },
  snapshot: {
    name: "The Warriors",
    type: "film",
    year: 1979,
    image: "https://example.com/the-warriors.jpg",
  },
  searchHint: { title: "The Warriors" },
  externalUrl: "https://example.com/the-warriors",
};

const existingBranch: TreeItem = {
  id: "branch_1",
  name: "Le Samourai",
  type: "film",
  year: 1967,
  reason: "",
  connectionType: "thematic",
  searchHint: { title: "Le Samourai" },
  identity: { source: "wikipedia", externalId: "Le_Samourai" },
  snapshot: leSamourai.snapshot,
  source: "user",
};

function resultAt(index: number): ExternalNodeSearchResult {
  return {
    kind: "addable-work",
    identity: { source: "wikipedia", externalId: `Result_${index}` },
    snapshot: {
      name: `Result ${index}`,
      type: "film",
      year: 2000 + index,
      image: `https://example.com/result-${index}.jpg`,
    },
    searchHint: { title: `Result ${index}` },
    externalUrl: `https://example.com/result-${index}`,
  };
}

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

  it("refuses to stage a creator subject (subjects are explored, never added)", () => {
    const radiohead: ExternalNodeSearchResult = {
      kind: "expandable-subject",
      identity: { source: "musicbrainz", externalId: "artist:abc123" },
      snapshot: { name: "Radiohead", type: "artist" },
      searchHint: { title: "Radiohead" },
    };

    expect(branchTrayUnavailableReason({ tray: [], existingBranches: [], result: radiohead })).toBe(
      "not-addable",
    );
    expect(stageSearchResult({ tray: [], result: radiohead })).toHaveLength(0);
  });

  it("stages multiple searched Branches in order", () => {
    const tray = stageSearchResult({
      tray: stageSearchResult({ tray: [], result: leSamourai }),
      result: theWarriors,
    });

    expect(tray.map((item) => item.result.snapshot.name)).toEqual(["Le Samourai", "The Warriors"]);
    expect(branchTraySubmitLabel(tray)).toBe("Add 2 Branches");
    expect(submitInputsFromBranchTray(tray)).toEqual([
      {
        kind: "search-result",
        result: leSamourai,
        connectionType: "thematic",
        reason: "",
      },
      {
        kind: "search-result",
        result: theWarriors,
        connectionType: "thematic",
        reason: "",
      },
    ]);
  });

  it("prevents staging duplicate canonical identities already in the tray", () => {
    const tray = stageSearchResult({
      tray: stageSearchResult({ tray: [], result: leSamourai }),
      result: leSamourai,
    });

    expect(tray).toHaveLength(1);
    expect(branchTrayUnavailableReason({ tray, existingBranches: [], result: leSamourai })).toBe(
      "staged",
    );
  });

  it("prevents staging Branches already present in the Culture Tree", () => {
    const tray = stageSearchResult({
      tray: [],
      existingBranches: [existingBranch],
      result: leSamourai,
    });

    expect(tray).toEqual([]);
    expect(
      branchTrayUnavailableReason({
        tray: [],
        existingBranches: [existingBranch],
        result: leSamourai,
      }),
    ).toBe("existing");
  });

  it("matches duplicates by normalized type, title, and year when identity differs", () => {
    const alternateResult: ExternalNodeSearchResult = {
      ...leSamourai,
      identity: { source: "tmdb", externalId: "le-samourai-1967" },
      snapshot: {
        ...leSamourai.snapshot,
        name: " le samourai! ",
      },
    };

    expect(
      branchTrayUnavailableReason({
        tray: [],
        existingBranches: [existingBranch],
        result: alternateResult,
      }),
    ).toBe("existing");
  });

  it("caps the tray at twelve Branches", () => {
    const fullTray = Array.from({ length: BRANCH_TRAY_MAX_ITEMS }, (_, index) =>
      resultAt(index),
    ).reduce<BranchTrayItem[]>((tray, result) => stageSearchResult({ tray, result }), []);

    expect(fullTray).toHaveLength(12);
    expect(stageSearchResult({ tray: fullTray, result: resultAt(99) })).toHaveLength(12);
    expect(
      branchTrayUnavailableReason({
        tray: fullTray,
        existingBranches: [],
        result: resultAt(99),
      }),
    ).toBe("full");
  });

  it("stages suggested results into only the available tray slots", () => {
    const almostFullTray = Array.from({ length: BRANCH_TRAY_MAX_ITEMS - 1 }, (_, index) =>
      resultAt(index),
    ).reduce<BranchTrayItem[]>((tray, result) => stageSearchResult({ tray, result }), []);

    const nextTray = stageSuggestedResults({
      tray: almostFullTray,
      existingBranches: [],
      results: [resultAt(20), resultAt(21)],
    });

    expect(nextTray).toHaveLength(BRANCH_TRAY_MAX_ITEMS);
    expect(nextTray.at(-1)).toMatchObject({
      result: resultAt(20),
      source: "suggested",
    });
  });

  it("skips suggested results that duplicate the existing tree or tray", () => {
    const tray = stageSearchResult({ tray: [], result: theWarriors });

    const nextTray = stageSuggestedResults({
      tray,
      existingBranches: [existingBranch],
      results: [leSamourai, theWarriors, resultAt(20)],
    });

    expect(nextTray.map((item) => item.result.snapshot.name)).toEqual([
      "The Warriors",
      "Result 20",
    ]);
    expect(nextTray.at(-1)?.source).toBe("suggested");
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
