import type { ExternalNodeSearchResult } from "@repo/schemas";

export const BRANCH_TRAY_DEFAULT_CONNECTION_TYPE = "thematic";

export type BranchTrayItem = {
  id: string;
  result: ExternalNodeSearchResult;
  source: "manual";
};

export type BranchTraySubmitInput = {
  kind: "search-result";
  result: ExternalNodeSearchResult;
  connectionType: typeof BRANCH_TRAY_DEFAULT_CONNECTION_TYPE;
  reason: "";
};

function branchTrayItemId(result: ExternalNodeSearchResult): string {
  return `${result.identity.source}:${result.identity.externalId}`;
}

export function stageSearchResult(input: {
  tray: readonly BranchTrayItem[];
  result: ExternalNodeSearchResult;
}): BranchTrayItem[] {
  return [
    ...input.tray,
    {
      id: branchTrayItemId(input.result),
      result: input.result,
      source: "manual",
    },
  ];
}

export function removeBranchTrayItem(input: {
  tray: readonly BranchTrayItem[];
  itemId: string;
}): BranchTrayItem[] {
  return input.tray.filter((item) => item.id !== input.itemId);
}

export function clearBranchTray(_tray: readonly BranchTrayItem[]): BranchTrayItem[] {
  return [];
}

export function branchTraySubmitLabel(tray: readonly BranchTrayItem[]): string {
  if (tray.length === 0) {
    return "Add Branches";
  }

  if (tray.length === 1) {
    return "Add Branch";
  }

  return `Add ${tray.length} Branches`;
}

export function canSubmitBranchTray(tray: readonly BranchTrayItem[]): boolean {
  return tray.length > 0;
}

export function submitInputFromBranchTray(
  tray: readonly BranchTrayItem[],
): BranchTraySubmitInput | null {
  const item = tray.at(0);
  if (!item) {
    return null;
  }

  return {
    kind: "search-result",
    result: item.result,
    connectionType: BRANCH_TRAY_DEFAULT_CONNECTION_TYPE,
    reason: "",
  };
}
