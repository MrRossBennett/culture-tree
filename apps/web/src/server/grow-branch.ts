import { db } from "@repo/db";
import { cultureTree, usageHistory } from "@repo/db/schema";
import { completeTreeItemConnection } from "@repo/engine";
import { ENTITLEMENTS, PLANS, type ProAllowlistSource } from "@repo/entitlements";
import {
  CultureTreeSchema,
  type CultureTree,
  type GuideSectionIdValue,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  prepareGrowBranchAllowanceDecision,
  type GrowBranchAllowanceDecision,
} from "./ai-generation-usage";
import type { AllowanceLimitReached } from "./allowance-gates";
import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";
import { addManualBranchToCultureTree, growBranchInCultureTree } from "./culture-tree-branches";
import { buildCultureTreeNode, type AddCultureTreeNodeDraft } from "./culture-tree-node-builder";
import { withLimitReachedMessage } from "./limit-reached-messages";
import { buildAcceptedAiGenerationUsage, type AllowancePeriod } from "./usage-history";

type GrowBranchPerson = {
  id: string;
  email?: string | null;
};

type GrowBranchRow = {
  id: string;
  userId: string;
  data: unknown;
  enrichmentData: unknown;
};

type CommitAcceptedGrowBranchInput = {
  treeId: string;
  tree: CultureTree;
  enrichments: TreeEnrichmentsMap;
  person: GrowBranchPerson;
  allowance: GrowBranchAllowanceDecision["allowance"];
  allowancePeriod: AllowancePeriod;
  proAllowlist?: ProAllowlistSource;
};

export type GrowBranchResult =
  | {
      ok: true;
      tree: CultureTree;
      branch: TreeItem;
      branchCount: number;
    }
  | { ok: false; limitReached: AllowanceLimitReached };

export type GrowBranchAdapters = {
  loadCultureTree: (treeId: string) => Promise<GrowBranchRow | null>;
  decideAllowance: (input: {
    person: GrowBranchPerson;
    cultureTreeId: string;
    proAllowlist?: ProAllowlistSource;
  }) => Promise<GrowBranchAllowanceDecision>;
  buildBranch: (node: AddCultureTreeNodeDraft) => TreeItem;
  completeBranchConnection: (tree: CultureTree, branch: TreeItem) => Promise<TreeItem>;
  prepareEnrichments: (input: {
    tree: CultureTree;
    branches: readonly TreeItem[];
    currentEnrichments: TreeEnrichmentsMap;
  }) => Promise<TreeEnrichmentsMap>;
  commitAcceptedGrowBranch: (input: CommitAcceptedGrowBranchInput) => Promise<void>;
  resolveCommittedBranches: (input: {
    treeId: string;
    branches: readonly TreeItem[];
    enrichments: TreeEnrichmentsMap;
  }) => Promise<void>;
};

async function loadCultureTree(treeId: string): Promise<GrowBranchRow | null> {
  const [row] = await db
    .select({
      id: cultureTree.id,
      userId: cultureTree.userId,
      data: cultureTree.data,
      enrichmentData: cultureTree.enrichmentData,
    })
    .from(cultureTree)
    .where(eq(cultureTree.id, treeId))
    .limit(1);
  return row ?? null;
}

async function commitAcceptedGrowBranch(input: CommitAcceptedGrowBranchInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(cultureTree)
      .set({ data: input.tree, enrichmentData: input.enrichments })
      .where(eq(cultureTree.id, input.treeId));

    await tx.insert(usageHistory).values(
      buildAcceptedAiGenerationUsage({
        id: nanoid(),
        person: input.person,
        cultureTreeId: input.treeId,
        usageType: ENTITLEMENTS.growBranch,
        proAllowlist: input.proAllowlist,
        allowancePeriod: input.allowance.effectivePlan === PLANS.pro ? input.allowancePeriod : null,
      }),
    );
  });
}

const defaultGrowBranchAdapters: GrowBranchAdapters = {
  loadCultureTree,
  decideAllowance: prepareGrowBranchAllowanceDecision,
  buildBranch: buildCultureTreeNode,
  completeBranchConnection: completeTreeItemConnection,
  prepareEnrichments: prepareEnrichmentsForCommittedBranches,
  commitAcceptedGrowBranch,
  resolveCommittedBranches,
};

export async function growBranch(input: {
  treeId: string;
  guideSectionId?: GuideSectionIdValue;
  node: AddCultureTreeNodeDraft;
  person: GrowBranchPerson;
  proAllowlist?: ProAllowlistSource;
  adapters?: Partial<GrowBranchAdapters>;
}): Promise<GrowBranchResult> {
  const adapters = { ...defaultGrowBranchAdapters, ...input.adapters };
  const row = await adapters.loadCultureTree(input.treeId);
  if (!row || row.userId !== input.person.id) {
    throw new Error("Tree not found");
  }

  const tree = CultureTreeSchema.parse(row.data);
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

  const draftBranch = adapters.buildBranch(input.node);
  const branch = await adapters.completeBranchConnection(tree, draftBranch);
  const nextTree = input.guideSectionId
    ? growBranchInCultureTree({
        tree,
        guideSectionId: input.guideSectionId,
        branch,
      })
    : addManualBranchToCultureTree({
        tree,
        branch,
      });
  const committedBranch = nextTree.items.at(-1);
  if (!committedBranch) {
    throw new Error("Branch was not committed.");
  }
  const enrichments = await adapters.prepareEnrichments({
    tree,
    branches: [committedBranch],
    currentEnrichments: parseTreeEnrichments(row.enrichmentData),
  });

  await adapters.commitAcceptedGrowBranch({
    treeId: input.treeId,
    tree: nextTree,
    enrichments,
    person: input.person,
    allowance,
    allowancePeriod,
    proAllowlist: input.proAllowlist,
  });

  await adapters.resolveCommittedBranches({
    treeId: input.treeId,
    branches: [committedBranch],
    enrichments,
  });

  return {
    ok: true,
    tree: nextTree,
    branch: committedBranch,
    branchCount: nextTree.items.length,
  };
}
