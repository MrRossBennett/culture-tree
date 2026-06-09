import type { ExternalNodeSearchResult, TreeItem } from "@repo/schemas";

export const BRANCH_TRAY_MAX_ITEMS = 12;
export const BRANCH_TRAY_DEFAULT_CONNECTION_TYPE = "thematic";

export type BranchTrayItem = {
  id: string;
  result: ExternalNodeSearchResult;
  source: "manual" | "suggested";
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

function normalizeSubjectTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectsMatch(
  left: {
    identity?: { source: string; externalId: string };
    name: string;
    type: string;
    year?: number;
  },
  right: {
    identity?: { source: string; externalId: string };
    name: string;
    type: string;
    year?: number;
  },
): boolean {
  if (
    left.identity &&
    right.identity &&
    left.identity.source === right.identity.source &&
    left.identity.externalId === right.identity.externalId
  ) {
    return true;
  }

  return (
    left.type === right.type &&
    normalizeSubjectTitle(left.name) === normalizeSubjectTitle(right.name) &&
    left.year === right.year
  );
}

function subjectFromResult(result: ExternalNodeSearchResult) {
  return {
    identity: result.identity,
    name: result.snapshot.name,
    type: result.snapshot.type,
    year: result.snapshot.year,
  };
}

function subjectFromBranch(branch: TreeItem) {
  return {
    identity: branch.identity,
    name: branch.snapshot?.name ?? branch.name,
    type: branch.snapshot?.type ?? branch.type,
    year: branch.snapshot?.year ?? branch.year,
  };
}

export function resultMatchesBranch(input: {
  result: ExternalNodeSearchResult;
  branch: TreeItem;
}): boolean {
  return subjectsMatch(subjectFromResult(input.result), subjectFromBranch(input.branch));
}

export function branchMatchesBranch(left: TreeItem, right: TreeItem): boolean {
  return subjectsMatch(subjectFromBranch(left), subjectFromBranch(right));
}

export function branchTrayUnavailableReason(input: {
  tray: readonly BranchTrayItem[];
  existingBranches: readonly TreeItem[];
  result: ExternalNodeSearchResult;
}): "staged" | "existing" | "full" | null {
  // Every classified result is addable, including creators (ADR 0005): a Tree can hold The
  // Beatles alongside their albums. The `kind` discriminant now only signals whether a result
  // is *also* expandable into its works, not whether it can be added.
  const stagedDuplicate = input.tray.some((item) =>
    subjectsMatch(subjectFromResult(item.result), subjectFromResult(input.result)),
  );
  if (stagedDuplicate) {
    return "staged";
  }

  const existingDuplicate = input.existingBranches.some((branch) =>
    resultMatchesBranch({ result: input.result, branch }),
  );
  if (existingDuplicate) {
    return "existing";
  }

  if (input.tray.length >= BRANCH_TRAY_MAX_ITEMS) {
    return "full";
  }

  return null;
}

export function stageSearchResult(input: {
  tray: readonly BranchTrayItem[];
  result: ExternalNodeSearchResult;
  existingBranches?: readonly TreeItem[];
  source?: BranchTrayItem["source"];
}): BranchTrayItem[] {
  if (
    branchTrayUnavailableReason({
      tray: input.tray,
      existingBranches: input.existingBranches ?? [],
      result: input.result,
    })
  ) {
    return [...input.tray];
  }

  return [
    ...input.tray,
    {
      id: branchTrayItemId(input.result),
      result: input.result,
      source: input.source ?? "manual",
    },
  ];
}

export function stageSuggestedResults(input: {
  tray: readonly BranchTrayItem[];
  existingBranches: readonly TreeItem[];
  results: readonly ExternalNodeSearchResult[];
}): BranchTrayItem[] {
  return input.results.reduce<BranchTrayItem[]>(
    (tray, result) =>
      stageSearchResult({
        tray,
        existingBranches: input.existingBranches,
        result,
        source: "suggested",
      }),
    [...input.tray],
  );
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
  return submitInputsFromBranchTray(tray).at(0) ?? null;
}

export function submitInputsFromBranchTray(
  tray: readonly BranchTrayItem[],
): BranchTraySubmitInput[] {
  return tray.map((item) => ({
    kind: "search-result",
    result: item.result,
    connectionType: BRANCH_TRAY_DEFAULT_CONNECTION_TYPE,
    reason: "",
  }));
}
