import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import {
  CultureTreeSchema,
  TreeItemSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";
import { addManualBranchToCultureTree } from "./culture-tree-branches";
import { canReadCultureTree } from "./culture-trees";
import { parseGenerationMetadata } from "./progressive-tree-generation-lifecycle";

type PublicBranchAddPerson = {
  id: string;
  email?: string | null;
};

type PublicBranchTreeRow = {
  id: string;
  userId: string;
  data: unknown;
  enrichmentData: unknown;
  isPublic: boolean;
  generationStatus: string;
  generationRunId: string | null;
  generationStage: string | null;
  generationUpdatedAt: Date;
  generationError: string | null;
  generationFinalData: unknown;
};

type CommitPublicBranchAddInput = {
  treeId: string;
  tree: CultureTree;
  enrichments: TreeEnrichmentsMap;
};

export type AddPublicBranchToTreeResult = {
  ok: true;
  tree: CultureTree;
  branch: TreeItem;
  branchCount: number;
};

export type AddPublicBranchToTreeAdapters = {
  loadCultureTree: (treeId: string) => Promise<PublicBranchTreeRow | null>;
  nextBranchId: () => string;
  prepareEnrichments: (input: {
    tree: CultureTree;
    branches: readonly TreeItem[];
    currentEnrichments: TreeEnrichmentsMap;
  }) => Promise<TreeEnrichmentsMap>;
  commitPublicBranchAdd: (input: CommitPublicBranchAddInput) => Promise<void>;
  resolveCommittedBranches: (input: {
    treeId: string;
    branches: readonly TreeItem[];
    enrichments: TreeEnrichmentsMap;
  }) => Promise<void>;
};

async function loadCultureTree(treeId: string): Promise<PublicBranchTreeRow | null> {
  const [row] = await db
    .select({
      id: cultureTree.id,
      userId: cultureTree.userId,
      data: cultureTree.data,
      enrichmentData: cultureTree.enrichmentData,
      isPublic: cultureTree.isPublic,
      generationStatus: cultureTree.generationStatus,
      generationRunId: cultureTree.generationRunId,
      generationStage: cultureTree.generationStage,
      generationUpdatedAt: cultureTree.generationUpdatedAt,
      generationError: cultureTree.generationError,
      generationFinalData: cultureTree.generationFinalData,
    })
    .from(cultureTree)
    .where(eq(cultureTree.id, treeId))
    .limit(1);
  return row ?? null;
}

async function commitPublicBranchAdd(input: CommitPublicBranchAddInput): Promise<void> {
  await db
    .update(cultureTree)
    .set({ data: input.tree, enrichmentData: input.enrichments })
    .where(eq(cultureTree.id, input.treeId));
}

const defaultAddPublicBranchToTreeAdapters: AddPublicBranchToTreeAdapters = {
  loadCultureTree,
  nextBranchId: nanoid,
  prepareEnrichments: prepareEnrichmentsForCommittedBranches,
  commitPublicBranchAdd,
  resolveCommittedBranches,
};

export function branchFromPublicTreeBranch(input: { branch: TreeItem; id: string }): TreeItem {
  return TreeItemSchema.parse({
    ...input.branch,
    id: input.id,
    branchRole: undefined,
    source: "user",
  });
}

export async function addPublicBranchToTree(input: {
  sourceTreeId: string;
  sourceBranchId: string;
  targetTreeId: string;
  person: PublicBranchAddPerson;
  adapters?: Partial<AddPublicBranchToTreeAdapters>;
}): Promise<AddPublicBranchToTreeResult> {
  const adapters = { ...defaultAddPublicBranchToTreeAdapters, ...input.adapters };
  const [sourceRow, targetRow] = await Promise.all([
    adapters.loadCultureTree(input.sourceTreeId),
    adapters.loadCultureTree(input.targetTreeId),
  ]);

  if (!sourceRow) {
    throw new Error("Source tree not found");
  }

  // The source can be the person's own tree (copying between their trees) or
  // anyone's readable public tree; canReadCultureTree covers both.
  const sourceGeneration = parseGenerationMetadata(sourceRow);
  const canReadSource = canReadCultureTree({
    currentUserId: input.person.id,
    ownerUserId: sourceRow.userId,
    isPublic: sourceRow.isPublic,
    generationStatus: sourceGeneration.status,
  });
  if (!canReadSource) {
    throw new Error("Source tree not found");
  }

  if (!targetRow || targetRow.userId !== input.person.id) {
    throw new Error("Target tree not found");
  }

  const sourceTree = CultureTreeSchema.parse(sourceRow.data);
  const targetTree = CultureTreeSchema.parse(targetRow.data);
  const sourceBranch = sourceTree.items.find((item) => item.id === input.sourceBranchId);
  if (!sourceBranch) {
    throw new Error("Branch not found");
  }

  const branch = branchFromPublicTreeBranch({
    branch: sourceBranch,
    id: adapters.nextBranchId(),
  });
  const nextTree = CultureTreeSchema.parse(
    addManualBranchToCultureTree({ tree: targetTree, branch }),
  );
  const committedBranch = nextTree.items.at(-1);
  if (!committedBranch) {
    throw new Error("Branch was not committed.");
  }

  const sourceEnrichments = parseTreeEnrichments(sourceRow.enrichmentData);
  const targetEnrichments = parseTreeEnrichments(targetRow.enrichmentData);
  const copiedEnrichment = sourceEnrichments[sourceBranch.id];
  const currentEnrichments = copiedEnrichment
    ? { ...targetEnrichments, [committedBranch.id]: copiedEnrichment }
    : targetEnrichments;
  const enrichments = await adapters.prepareEnrichments({
    tree: targetTree,
    branches: [committedBranch],
    currentEnrichments,
  });

  await adapters.commitPublicBranchAdd({
    treeId: input.targetTreeId,
    tree: nextTree,
    enrichments,
  });

  await adapters.resolveCommittedBranches({
    treeId: input.targetTreeId,
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
