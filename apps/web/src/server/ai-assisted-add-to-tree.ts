import { db } from "@repo/db";
import { cultureTree, usageHistory } from "@repo/db/schema";
import { generateTree, searchExternalNodes } from "@repo/engine";
import { ENTITLEMENTS, PLANS, type ProAllowlistSource } from "@repo/entitlements";
import {
  CultureTreeSchema,
  type CultureTree,
  type ExternalNodeSearchResult,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  BRANCH_TRAY_MAX_ITEMS,
  branchTrayUnavailableReason,
  stageSearchResult,
  type BranchTrayItem,
} from "~/lib/branch-tray-state";

import {
  prepareGrowBranchAllowanceDecision,
  type GrowBranchAllowanceDecision,
} from "./ai-generation-usage";
import type { AllowanceLimitReached } from "./allowance-gates";
import { withLimitReachedMessage } from "./limit-reached-messages";
import { buildAcceptedAiGenerationUsage, type AllowancePeriod } from "./usage-history";

type SuggestBranchesPerson = {
  id: string;
  email?: string | null;
};

type SuggestBranchesRow = {
  id: string;
  userId: string;
  data: unknown;
};

type RecordSuggestionUsageInput = {
  treeId: string;
  person: SuggestBranchesPerson;
  allowance: GrowBranchAllowanceDecision["allowance"];
  allowancePeriod: AllowancePeriod;
  proAllowlist?: ProAllowlistSource;
};

export type SuggestBranchesForAddToTreeResult =
  | {
      ok: true;
      suggestions: ExternalNodeSearchResult[];
    }
  | { ok: false; limitReached: AllowanceLimitReached };

export type SuggestBranchesForAddToTreeAdapters = {
  loadCultureTree: (treeId: string) => Promise<SuggestBranchesRow | null>;
  decideAllowance: (input: {
    person: SuggestBranchesPerson;
    cultureTreeId: string;
    proAllowlist?: ProAllowlistSource;
  }) => Promise<GrowBranchAllowanceDecision>;
  suggestCandidateBranches: (tree: CultureTree) => Promise<TreeItem[]>;
  recognizeCandidate: (item: TreeItem) => Promise<ExternalNodeSearchResult | null>;
  recordSuggestionUsage: (input: RecordSuggestionUsageInput) => Promise<void>;
};

async function loadCultureTree(treeId: string): Promise<SuggestBranchesRow | null> {
  const [row] = await db
    .select({
      id: cultureTree.id,
      userId: cultureTree.userId,
      data: cultureTree.data,
    })
    .from(cultureTree)
    .where(eq(cultureTree.id, treeId))
    .limit(1);
  return row ?? null;
}

function suggestionQueryForTree(tree: CultureTree): string {
  const title = tree.seed?.trim() || tree.title?.trim() || "this Culture Tree";
  const items = tree.items
    .slice(0, 8)
    .map((item) => item.name)
    .join(", ");
  return items ? `${title}; current Branches: ${items}` : title;
}

async function suggestCandidateBranches(tree: CultureTree): Promise<TreeItem[]> {
  const generated = await generateTree({
    query: suggestionQueryForTree(tree),
    depth: "shallow",
    tone: "mixed",
  });
  return generated.items;
}

async function recognizeCandidate(item: TreeItem): Promise<ExternalNodeSearchResult | null> {
  const results = await searchExternalNodes(item.searchHint.title);
  return results.find((result) => result.snapshot.type === item.type) ?? results.at(0) ?? null;
}

async function recordSuggestionUsage(input: RecordSuggestionUsageInput): Promise<void> {
  await db.insert(usageHistory).values(
    buildAcceptedAiGenerationUsage({
      id: nanoid(),
      person: input.person,
      cultureTreeId: input.treeId,
      usageType: ENTITLEMENTS.growBranch,
      proAllowlist: input.proAllowlist,
      allowancePeriod: input.allowance.effectivePlan === PLANS.pro ? input.allowancePeriod : null,
    }),
  );
}

const defaultSuggestBranchesForAddToTreeAdapters: SuggestBranchesForAddToTreeAdapters = {
  loadCultureTree,
  decideAllowance: prepareGrowBranchAllowanceDecision,
  suggestCandidateBranches,
  recognizeCandidate,
  recordSuggestionUsage,
};

export async function suggestBranchesForAddToTree(input: {
  treeId: string;
  trayResults: readonly ExternalNodeSearchResult[];
  person: SuggestBranchesPerson;
  proAllowlist?: ProAllowlistSource;
  adapters?: Partial<SuggestBranchesForAddToTreeAdapters>;
}): Promise<SuggestBranchesForAddToTreeResult> {
  const adapters = { ...defaultSuggestBranchesForAddToTreeAdapters, ...input.adapters };
  const row = await adapters.loadCultureTree(input.treeId);
  if (!row || row.userId !== input.person.id) {
    throw new Error("Tree not found");
  }

  const tree = CultureTreeSchema.parse(row.data);
  let tray = input.trayResults.reduce<BranchTrayItem[]>(
    (currentTray, result) => stageSearchResult({ tray: currentTray, result }),
    [],
  );
  const availableSlots = Math.max(BRANCH_TRAY_MAX_ITEMS - tray.length, 0);
  if (availableSlots === 0) {
    return { ok: true, suggestions: [] };
  }

  const { allowance, allowancePeriod } = await adapters.decideAllowance({
    person: input.person,
    cultureTreeId: input.treeId,
    proAllowlist: input.proAllowlist,
  });
  if (!allowance.allowed) {
    return {
      ok: false,
      limitReached: withLimitReachedMessage({
        action: "grow_branch",
        limitReached: allowance.limitReached,
      }),
    };
  }

  const suggestions: ExternalNodeSearchResult[] = [];
  const candidates = await adapters.suggestCandidateBranches(tree);
  for (const candidate of candidates) {
    if (suggestions.length >= Math.min(5, availableSlots)) {
      break;
    }

    const result = await adapters.recognizeCandidate(candidate);
    if (!result) {
      continue;
    }

    const unavailable = branchTrayUnavailableReason({
      tray,
      existingBranches: tree.items,
      result,
    });
    if (unavailable) {
      continue;
    }

    suggestions.push(result);
    tray = stageSearchResult({
      tray,
      existingBranches: tree.items,
      result,
      source: "suggested",
    });
  }

  await adapters.recordSuggestionUsage({
    treeId: input.treeId,
    person: input.person,
    allowance,
    allowancePeriod,
    proAllowlist: input.proAllowlist,
  });

  return { ok: true, suggestions };
}
