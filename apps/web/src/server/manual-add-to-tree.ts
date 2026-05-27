import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import {
  CultureTreeSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";

import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";
import { addManualBranchToCultureTree } from "./culture-tree-branches";
import { buildCultureTreeNode, type AddCultureTreeNodeDraft } from "./culture-tree-node-builder";

type ManualAddPerson = {
  id: string;
  email?: string | null;
};

type ManualAddRow = {
  id: string;
  userId: string;
  data: unknown;
  enrichmentData: unknown;
};

type CommitManualAddToTreeInput = {
  treeId: string;
  tree: CultureTree;
  enrichments: TreeEnrichmentsMap;
};

export type ManualAddToTreeResult = {
  ok: true;
  tree: CultureTree;
  branch: TreeItem;
  branchCount: number;
};

export type ManualAddToTreeAdapters = {
  loadCultureTree: (treeId: string) => Promise<ManualAddRow | null>;
  buildBranch: (node: AddCultureTreeNodeDraft) => TreeItem;
  prepareEnrichments: (input: {
    tree: CultureTree;
    branches: readonly TreeItem[];
    currentEnrichments: TreeEnrichmentsMap;
  }) => Promise<TreeEnrichmentsMap>;
  commitManualAddToTree: (input: CommitManualAddToTreeInput) => Promise<void>;
  resolveCommittedBranches: (input: {
    treeId: string;
    branches: readonly TreeItem[];
    enrichments: TreeEnrichmentsMap;
  }) => Promise<void>;
};

async function loadCultureTree(treeId: string): Promise<ManualAddRow | null> {
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

async function commitManualAddToTree(input: CommitManualAddToTreeInput): Promise<void> {
  await db
    .update(cultureTree)
    .set({ data: input.tree, enrichmentData: input.enrichments })
    .where(eq(cultureTree.id, input.treeId));
}

const defaultManualAddToTreeAdapters: ManualAddToTreeAdapters = {
  loadCultureTree,
  buildBranch: buildCultureTreeNode,
  prepareEnrichments: prepareEnrichmentsForCommittedBranches,
  commitManualAddToTree,
  resolveCommittedBranches,
};

export async function manualAddToTree(input: {
  treeId: string;
  node: AddCultureTreeNodeDraft;
  person: ManualAddPerson;
  adapters?: Partial<ManualAddToTreeAdapters>;
}): Promise<ManualAddToTreeResult> {
  const adapters = { ...defaultManualAddToTreeAdapters, ...input.adapters };
  const row = await adapters.loadCultureTree(input.treeId);
  if (!row || row.userId !== input.person.id) {
    throw new Error("Tree not found");
  }

  const tree = CultureTreeSchema.parse(row.data);
  const branch = adapters.buildBranch(input.node);
  const nextTree = CultureTreeSchema.parse(addManualBranchToCultureTree({ tree, branch }));
  const committedBranch = nextTree.items.at(-1);
  if (!committedBranch) {
    throw new Error("Branch was not committed.");
  }

  const enrichments = await adapters.prepareEnrichments({
    tree,
    branches: [committedBranch],
    currentEnrichments: parseTreeEnrichments(row.enrichmentData),
  });

  await adapters.commitManualAddToTree({
    treeId: input.treeId,
    tree: nextTree,
    enrichments,
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
