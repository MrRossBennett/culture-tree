import { db } from "@repo/db";
import { cultureTree, entity, entityLike } from "@repo/db/schema";
import {
  CultureTreeSchema,
  ExternalNodeSource,
  NodeType,
  TreeItemSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "./committed-branch-enrichment";
import { addManualBranchToCultureTree } from "./culture-tree-branches";

type LikedBranchPerson = {
  id: string;
  email?: string | null;
};

type TargetTreeRow = {
  id: string;
  userId: string;
  data: unknown;
  enrichmentData: unknown;
};

type LikedEntityRow = {
  id: string;
  type: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  primaryExternalSource: string;
  primaryExternalId: string;
};

type CommitLikedBranchAddInput = {
  treeId: string;
  tree: CultureTree;
  enrichments: TreeEnrichmentsMap;
};

export type AddLikedBranchToTreeResult = {
  ok: true;
  tree: CultureTree;
  branch: TreeItem;
  branchCount: number;
};

export type AddLikedBranchToTreeAdapters = {
  loadTargetTree: (treeId: string) => Promise<TargetTreeRow | null>;
  loadLikedEntity: (input: { entityId: string; userId: string }) => Promise<LikedEntityRow | null>;
  nextBranchId: () => string;
  prepareEnrichments: (input: {
    tree: CultureTree;
    branches: readonly TreeItem[];
    currentEnrichments: TreeEnrichmentsMap;
  }) => Promise<TreeEnrichmentsMap>;
  commitLikedBranchAdd: (input: CommitLikedBranchAddInput) => Promise<void>;
  resolveCommittedBranches: (input: {
    treeId: string;
    branches: readonly TreeItem[];
    enrichments: TreeEnrichmentsMap;
  }) => Promise<void>;
};

async function loadTargetTree(treeId: string): Promise<TargetTreeRow | null> {
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

async function loadLikedEntity(input: {
  entityId: string;
  userId: string;
}): Promise<LikedEntityRow | null> {
  const [row] = await db
    .select({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      year: entity.year,
      imageUrl: entity.imageUrl,
      primaryExternalSource: entity.primaryExternalSource,
      primaryExternalId: entity.primaryExternalId,
    })
    .from(entityLike)
    .innerJoin(entity, eq(entity.id, entityLike.entityId))
    .where(and(eq(entityLike.userId, input.userId), eq(entityLike.entityId, input.entityId)))
    .limit(1);
  return row ?? null;
}

async function commitLikedBranchAdd(input: CommitLikedBranchAddInput): Promise<void> {
  await db
    .update(cultureTree)
    .set({ data: input.tree, enrichmentData: input.enrichments })
    .where(eq(cultureTree.id, input.treeId));
}

const defaultAddLikedBranchToTreeAdapters: AddLikedBranchToTreeAdapters = {
  loadTargetTree,
  loadLikedEntity,
  nextBranchId: nanoid,
  prepareEnrichments: prepareEnrichmentsForCommittedBranches,
  commitLikedBranchAdd,
  resolveCommittedBranches,
};

export function branchFromLikedEntity(input: { entity: LikedEntityRow; id: string }): TreeItem {
  const type = NodeType.parse(input.entity.type);
  const source = ExternalNodeSource.parse(input.entity.primaryExternalSource);

  return TreeItemSchema.parse({
    id: input.id,
    name: input.entity.name,
    type,
    year: input.entity.year ?? undefined,
    reason: "",
    connectionType: "thematic",
    searchHint: { title: input.entity.name },
    identity: {
      source,
      externalId: input.entity.primaryExternalId,
    },
    snapshot: {
      name: input.entity.name,
      type,
      year: input.entity.year ?? undefined,
      image: input.entity.imageUrl ?? undefined,
    },
    source: "user",
  });
}

export async function addLikedBranchToTree(input: {
  entityId: string;
  targetTreeId: string;
  person: LikedBranchPerson;
  adapters?: Partial<AddLikedBranchToTreeAdapters>;
}): Promise<AddLikedBranchToTreeResult> {
  const adapters = { ...defaultAddLikedBranchToTreeAdapters, ...input.adapters };
  const [targetRow, likedEntity] = await Promise.all([
    adapters.loadTargetTree(input.targetTreeId),
    adapters.loadLikedEntity({ entityId: input.entityId, userId: input.person.id }),
  ]);

  if (!likedEntity) {
    throw new Error("Liked Branch not found");
  }

  if (!targetRow || targetRow.userId !== input.person.id) {
    throw new Error("Target tree not found");
  }

  const tree = CultureTreeSchema.parse(targetRow.data);
  const branch = branchFromLikedEntity({
    entity: likedEntity,
    id: adapters.nextBranchId(),
  });
  const nextTree = CultureTreeSchema.parse(addManualBranchToCultureTree({ tree, branch }));
  const committedBranch = nextTree.items.at(-1);
  if (!committedBranch) {
    throw new Error("Branch was not committed.");
  }

  const enrichments = await adapters.prepareEnrichments({
    tree,
    branches: [committedBranch],
    currentEnrichments: parseTreeEnrichments(targetRow.enrichmentData),
  });

  await adapters.commitLikedBranchAdd({
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
