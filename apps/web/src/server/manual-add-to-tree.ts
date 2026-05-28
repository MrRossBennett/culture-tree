import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import {
  CultureTreeSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";

import { BRANCH_TRAY_MAX_ITEMS, branchMatchesBranch } from "~/lib/branch-tray-state";

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

export type ManualAddBranchesToTreeResult = {
  ok: true;
  tree: CultureTree;
  branches: TreeItem[];
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

function assertBranchesCanBeAdded(input: {
  tree: CultureTree;
  branches: readonly TreeItem[];
}): void {
  if (input.branches.length > BRANCH_TRAY_MAX_ITEMS) {
    throw new Error(`Branch Tray cannot contain more than ${BRANCH_TRAY_MAX_ITEMS} Branches.`);
  }

  for (const branch of input.branches) {
    if (input.tree.items.some((existingBranch) => branchMatchesBranch(existingBranch, branch))) {
      throw new Error("Branch already exists in this Culture Tree.");
    }
  }

  for (let index = 0; index < input.branches.length; index += 1) {
    const branch = input.branches[index];
    const duplicate = input.branches
      .slice(index + 1)
      .some((nextBranch) => branchMatchesBranch(branch, nextBranch));
    if (duplicate) {
      throw new Error("Duplicate Branch in Add to Tree batch.");
    }
  }
}

export async function manualAddToTree(input: {
  treeId: string;
  node: AddCultureTreeNodeDraft;
  person: ManualAddPerson;
  adapters?: Partial<ManualAddToTreeAdapters>;
}): Promise<ManualAddToTreeResult> {
  const result = await manualAddBranchesToTree({
    treeId: input.treeId,
    nodes: [input.node],
    person: input.person,
    adapters: input.adapters,
  });
  const branch = result.branches.at(0);
  if (!branch) {
    throw new Error("Branch was not committed.");
  }

  return {
    ok: true,
    tree: result.tree,
    branch,
    branchCount: result.branchCount,
  };
}

export async function manualAddBranchesToTree(input: {
  treeId: string;
  nodes: readonly AddCultureTreeNodeDraft[];
  person: ManualAddPerson;
  adapters?: Partial<ManualAddToTreeAdapters>;
}): Promise<ManualAddBranchesToTreeResult> {
  const adapters = { ...defaultManualAddToTreeAdapters, ...input.adapters };
  const row = await adapters.loadCultureTree(input.treeId);
  if (!row || row.userId !== input.person.id) {
    throw new Error("Tree not found");
  }
  if (input.nodes.length === 0) {
    throw new Error("At least one Branch is required.");
  }

  const tree = CultureTreeSchema.parse(row.data);
  const branches = input.nodes.map((node) => adapters.buildBranch(node));
  assertBranchesCanBeAdded({ tree, branches });
  const nextTree = CultureTreeSchema.parse(
    branches.reduce(
      (currentTree, branch) => addManualBranchToCultureTree({ tree: currentTree, branch }),
      tree,
    ),
  );
  const committedBranches = nextTree.items.slice(tree.items.length);
  if (committedBranches.length !== branches.length) {
    throw new Error("Branch was not committed.");
  }

  const enrichments = await adapters.prepareEnrichments({
    tree,
    branches: committedBranches,
    currentEnrichments: parseTreeEnrichments(row.enrichmentData),
  });

  await adapters.commitManualAddToTree({
    treeId: input.treeId,
    tree: nextTree,
    enrichments,
  });

  await adapters.resolveCommittedBranches({
    treeId: input.treeId,
    branches: committedBranches,
    enrichments,
  });

  return {
    ok: true,
    tree: nextTree,
    branches: committedBranches,
    branchCount: nextTree.items.length,
  };
}
