import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { enrichTree, generateTree } from "@repo/engine";
import {
  CultureTreeSchema,
  NodeType,
  TreeEnrichmentsMapSchema,
  TreeItemSchema,
  type CultureTree,
  type TreeEnrichmentsMap,
  type TreeItem,
  type TreeRequest,
} from "@repo/schemas";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  enqueueTreeForResolution,
  kickEntityResolutionRunner,
  resolveImmediateTreeItems,
} from "./entity-resolver.server";
import {
  StartGenerationInputSchema,
  draftTreeForSeed,
  isGenerationActive,
  isGenerationStale,
  nextRevealItemIndex,
  parseGenerationFinalData,
  parseGenerationMetadata,
  parseMediaFilter,
} from "./progressive-tree-generation-lifecycle";

const REVEAL_DELAY_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameMediaFilter(a: unknown, b: readonly string[] | undefined): boolean {
  const parsed = parseMediaFilter(a) ?? [];
  const next = b ?? [];
  return parsed.length === next.length && parsed.every((value, index) => value === next[index]);
}

function parseTreeEnrichments(value: unknown): TreeEnrichmentsMap {
  const parsed = TreeEnrichmentsMapSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

function hasUsefulEnrichment(value: unknown): boolean {
  return value != null && typeof value === "object" && Object.keys(value).length > 0;
}

async function guardedUpdate(
  treeId: string,
  runId: string,
  values: Partial<typeof cultureTree.$inferInsert>,
): Promise<boolean> {
  const rows = await db
    .update(cultureTree)
    .set({ ...values, generationUpdatedAt: new Date() })
    .where(and(eq(cultureTree.id, treeId), eq(cultureTree.generationRunId, runId)))
    .returning({ id: cultureTree.id });
  return rows.length > 0;
}

async function markGenerationFailed(treeId: string, runId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Tree generation stopped.";
  await guardedUpdate(treeId, runId, {
    generationStatus: "failed",
    generationStage: "Stopped",
    generationError: message,
  });
}

async function enrichCommittedItems(
  treeId: string,
  tree: CultureTree,
  items: readonly TreeItem[],
): Promise<void> {
  if (items.length === 0 || process.env.MOCK_ENGINE === "true") {
    await enqueueTreeForResolution({ treeId, items: [...items] });
    kickEntityResolutionRunner();
    return;
  }

  const [row] = await db
    .select({ enrichmentData: cultureTree.enrichmentData })
    .from(cultureTree)
    .where(eq(cultureTree.id, treeId))
    .limit(1);
  const currentEnrichments = parseTreeEnrichments(row?.enrichmentData);
  const partialTree = CultureTreeSchema.parse({ ...tree, items: [...items] });
  const map = await enrichTree(partialTree);
  const newEnrichments = Object.fromEntries(map);
  TreeEnrichmentsMapSchema.parse(newEnrichments);
  const nextEnrichments = { ...currentEnrichments, ...newEnrichments };
  TreeEnrichmentsMapSchema.parse(nextEnrichments);

  await db
    .update(cultureTree)
    .set({ enrichmentData: nextEnrichments })
    .where(eq(cultureTree.id, treeId));

  await resolveImmediateTreeItems({ treeId, items: [...items], enrichments: nextEnrichments });
  await enqueueTreeForResolution({ treeId, items: [...items] });
  kickEntityResolutionRunner();
}

async function revealFinalTree(
  treeId: string,
  runId: string,
  finalTree: CultureTree,
): Promise<void> {
  while (true) {
    const [row] = await db
      .select({
        data: cultureTree.data,
        generationRunId: cultureTree.generationRunId,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, treeId))
      .limit(1);

    if (!row || row.generationRunId !== runId) {
      return;
    }

    const currentTree = CultureTreeSchema.parse(row.data);
    const nextIndex = nextRevealItemIndex(currentTree.items.length);
    const nextItem = finalTree.items[nextIndex];

    if (!nextItem) {
      await guardedUpdate(treeId, runId, {
        data: currentTree,
        generationStatus: "ready",
        generationStage: "Ready",
        generationError: null,
      });
      return;
    }

    const nextTree = CultureTreeSchema.parse({
      ...currentTree,
      seed: finalTree.seed,
      seedType: finalTree.seedType,
      items: [...currentTree.items, nextItem],
    });
    const updated = await guardedUpdate(treeId, runId, {
      data: nextTree,
      generationStatus: "revealing",
      generationStage: `Revealing branch ${nextIndex + 1} of ${finalTree.items.length}`,
    });
    if (!updated) {
      return;
    }

    try {
      await enrichCommittedItems(treeId, nextTree, [nextItem]);
    } catch (error) {
      console.error("Progressive branch enrichment failed", error);
    }

    if (nextTree.items.length >= finalTree.items.length) {
      await guardedUpdate(treeId, runId, {
        generationStatus: "ready",
        generationStage: "Ready",
        generationError: null,
      });
      return;
    }

    await sleep(REVEAL_DELAY_MS);
  }
}

async function runProgressiveGeneration(treeId: string, runId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        seedQuery: cultureTree.seedQuery,
        depth: cultureTree.depth,
        tone: cultureTree.tone,
        mediaFilter: cultureTree.mediaFilter,
        generationFinalData: cultureTree.generationFinalData,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, treeId))
      .limit(1);

    if (!row) {
      return;
    }

    const existingFinalTree = parseGenerationFinalData(row.generationFinalData);
    const finalTree =
      existingFinalTree ??
      (await (async () => {
        await guardedUpdate(treeId, runId, {
          generationStatus: "running",
          generationStage: "Planning the shape of the tree",
          generationError: null,
        });
        const request: TreeRequest = {
          query: row.seedQuery,
          depth: StartGenerationInputSchema.shape.depth.parse(row.depth),
          tone: StartGenerationInputSchema.shape.tone.parse(row.tone),
          mediaFilter: parseMediaFilter(row.mediaFilter),
        };
        const generated = CultureTreeSchema.parse(await generateTree(request));
        await guardedUpdate(treeId, runId, {
          generationStatus: "revealing",
          generationStage: "Checking the final branches",
          generationFinalData: generated,
          generationError: null,
        });
        return generated;
      })());

    await revealFinalTree(treeId, runId, finalTree);
  } catch (error) {
    console.error("Progressive tree generation failed", error);
    await markGenerationFailed(treeId, runId, error);
  }
}

function kickGenerationRunner(treeId: string, runId: string): void {
  void runProgressiveGeneration(treeId, runId);
}

async function findFreshActiveDraft(userId: string, data: TreeRequest) {
  const rows = await db
    .select({
      id: cultureTree.id,
      seedQuery: cultureTree.seedQuery,
      depth: cultureTree.depth,
      tone: cultureTree.tone,
      mediaFilter: cultureTree.mediaFilter,
      generationStatus: cultureTree.generationStatus,
      generationRunId: cultureTree.generationRunId,
      generationStage: cultureTree.generationStage,
      generationUpdatedAt: cultureTree.generationUpdatedAt,
      generationError: cultureTree.generationError,
      generationFinalData: cultureTree.generationFinalData,
    })
    .from(cultureTree)
    .where(eq(cultureTree.userId, userId));

  return rows.find((row) => {
    if (
      row.seedQuery !== data.query ||
      row.depth !== data.depth ||
      row.tone !== data.tone ||
      !sameMediaFilter(row.mediaFilter, data.mediaFilter)
    ) {
      return false;
    }
    const metadata = parseGenerationMetadata(row);
    return isGenerationActive(metadata.status) && !isGenerationStale(metadata);
  });
}

async function startProgressiveCultureTree(userId: string, data: TreeRequest) {
  const existing = await findFreshActiveDraft(userId, data);
  if (existing) {
    return { treeId: existing.id };
  }

  const treeId = nanoid();
  const runId = nanoid();
  await db.insert(cultureTree).values({
    id: treeId,
    userId,
    data: draftTreeForSeed(data.query),
    seedQuery: data.query,
    depth: data.depth,
    tone: data.tone,
    mediaFilter: data.mediaFilter,
    isPublic: false,
    generationStatus: "queued",
    generationRunId: runId,
    generationStage: "Preparing the seed",
    generationUpdatedAt: new Date(),
  });

  kickGenerationRunner(treeId, runId);
  return { treeId };
}

export const $generateCultureTree = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(StartGenerationInputSchema)
  .handler(async ({ data, context }) => startProgressiveCultureTree(context.user.id, data));

export const $retryCultureTreeGeneration = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ treeId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const [row] = await db
      .select({
        id: cultureTree.id,
        userId: cultureTree.userId,
        data: cultureTree.data,
        enrichmentData: cultureTree.enrichmentData,
        generationStatus: cultureTree.generationStatus,
        generationRunId: cultureTree.generationRunId,
        generationStage: cultureTree.generationStage,
        generationUpdatedAt: cultureTree.generationUpdatedAt,
        generationError: cultureTree.generationError,
        generationFinalData: cultureTree.generationFinalData,
      })
      .from(cultureTree)
      .where(eq(cultureTree.id, data.treeId))
      .limit(1);

    if (!row || row.userId !== context.user.id) {
      throw new Error("Tree not found");
    }

    const metadata = parseGenerationMetadata(row);
    if (isGenerationActive(metadata.status) && !isGenerationStale(metadata)) {
      return { treeId: row.id, status: metadata.status };
    }

    const tree = CultureTreeSchema.parse(row.data);
    const finalTree = parseGenerationFinalData(row.generationFinalData);
    const enrichments = parseTreeEnrichments(row.enrichmentData);
    const missingEnrichment = tree.items.filter(
      (item) => !hasUsefulEnrichment(enrichments[item.id]),
    );

    if (metadata.status === "ready" && missingEnrichment.length > 0) {
      await enrichCommittedItems(row.id, tree, missingEnrichment);
      return { treeId: row.id, status: "ready" as const };
    }

    const runId = nanoid();
    await db
      .update(cultureTree)
      .set({
        generationStatus: finalTree ? "revealing" : "queued",
        generationRunId: runId,
        generationStage: finalTree ? "Resuming the branch reveal" : "Preparing the seed",
        generationUpdatedAt: new Date(),
        generationError: null,
      })
      .where(eq(cultureTree.id, row.id));

    kickGenerationRunner(row.id, runId);
    return { treeId: row.id, status: finalTree ? "revealing" : "queued" };
  });

export const $seedTreeFromItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      item: TreeItemSchema,
      mediaFilter: z.array(NodeType).optional(),
      tone: StartGenerationInputSchema.shape.tone.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const query = data.item.year ? `${data.item.name} (${data.item.year})` : data.item.name;

    return startProgressiveCultureTree(context.user.id, {
      query,
      depth: "standard",
      tone: data.tone ?? "mixed",
      mediaFilter: data.mediaFilter,
    });
  });
