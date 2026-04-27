import { anthropic } from "@ai-sdk/anthropic";
import {
  ConnectionType,
  CultureTreeSchema,
  TreeItemSchema,
  TreeRequestSchema,
  normalizeCultureTreeOutput,
  type CultureTree,
  type TreeItem,
  type TreeRequest,
} from "@repo/schemas";
import { Output, generateText } from "ai";
import { z } from "zod";

import { mockCultureTreeForRequest } from "../fixtures/mock-tree";
import {
  SYSTEM_PROMPT,
  buildMediaFilterRepairPrompt,
  buildPass1Prompt,
  buildPass2Prompt,
  buildPass3Prompt,
} from "./prompts";

const model = anthropic("claude-sonnet-4-20250514");

async function generatePass(
  system: string,
  prompt: string,
  seedLabel: string,
): Promise<CultureTree> {
  const result = await generateText({
    model,
    system,
    prompt,
    output: Output.object({
      name: "CultureTree",
      description:
        "Culture connection tree: every item has searchHint.title (work title or primary label) and searchHint.creator (author/artist/etc.) as separate strings when the item type is a creative work.",
      schema: CultureTreeSchema,
    }),
  });
  return normalizeCultureTreeOutput(result.output, seedLabel);
}

function treeMatchesMediaFilter(tree: CultureTree, mediaFilter?: readonly string[]): boolean {
  if (!mediaFilter?.length) {
    return true;
  }

  const allowedTypes = new Set(mediaFilter);
  return tree.items.every((item) => allowedTypes.has(item.type));
}

function pruneTreeToMediaFilter(tree: CultureTree, mediaFilter?: readonly string[]): CultureTree {
  if (!mediaFilter?.length) {
    return tree;
  }

  const allowedTypes = new Set(mediaFilter);
  return {
    ...tree,
    items: tree.items.filter((item) => allowedTypes.has(item.type)),
  };
}

async function repairTreeForMediaFilter(
  query: string,
  tree: CultureTree,
  mediaFilter?: readonly string[],
): Promise<CultureTree> {
  if (treeMatchesMediaFilter(tree, mediaFilter)) {
    return tree;
  }

  if (!mediaFilter?.length) {
    return tree;
  }

  const repaired = await generatePass(
    SYSTEM_PROMPT,
    buildMediaFilterRepairPrompt(query, tree, [...mediaFilter]),
    query,
  );

  if (treeMatchesMediaFilter(repaired, mediaFilter)) {
    return repaired;
  }

  return pruneTreeToMediaFilter(repaired, mediaFilter);
}

export async function generateTree(request: TreeRequest): Promise<CultureTree> {
  if (process.env.MOCK_ENGINE === "true") {
    return mockCultureTreeForRequest(request);
  }

  const data = TreeRequestSchema.parse(request);
  const { query, depth, mediaFilter, tone } = data;

  const depthConfig = {
    shallow: { count: "6-8" },
    standard: { count: "10-14" },
    deep: { count: "16-20" },
  }[depth];

  const pass1 = await generatePass(
    SYSTEM_PROMPT,
    buildPass1Prompt(query, depthConfig, mediaFilter, tone),
    query,
  );

  if (depth === "shallow") return repairTreeForMediaFilter(query, pass1, mediaFilter);

  const pass2 = await generatePass(
    SYSTEM_PROMPT,
    buildPass2Prompt(query, pass1, mediaFilter, tone),
    query,
  );

  if (depth === "standard") return repairTreeForMediaFilter(query, pass2, mediaFilter);

  const pass3 = await generatePass(
    SYSTEM_PROMPT,
    buildPass3Prompt(query, pass2, mediaFilter),
    query,
  );
  return repairTreeForMediaFilter(query, pass3, mediaFilter);
}

const TreeItemConnectionSchema = z.object({
  reason: z.string().trim().min(1),
  connectionType: ConnectionType,
});

function buildTreeItemConnectionPrompt(tree: CultureTree, item: TreeItem): string {
  const existingItems = tree.items
    .map(
      (existing) =>
        `- ${existing.name} [${existing.type}, ${existing.connectionType}]: "${existing.reason}"`,
    )
    .join("\n");

  return `Complete the connection metadata for a new item being added to this culture tree.

Tree seed: "${tree.seed}"

Existing tree items:
${existingItems || "- No existing items yet."}

New item:
- ${item.name} [${item.type}]${item.year != null ? ` (${item.year})` : ""}

Write the "reason" exactly like Culture Tree generation reasons:
- Explain why this item belongs in THIS tree, tied to the seed and the tree's existing world.
- Be specific, insightful, and non-generic.
- One sentence, 30 words max.
- Do not write an encyclopedia description of the item.

Also choose the best connectionType enum value for this relationship.

Return only the structured object.`;
}

export async function completeTreeItemConnection(
  tree: CultureTree,
  item: TreeItem,
): Promise<TreeItem> {
  if (process.env.MOCK_ENGINE === "true") {
    return TreeItemSchema.parse({
      ...item,
      reason:
        item.reason.trim() ||
        `${item.name} extends ${tree.seed} through a curator-added connection awaiting live generation.`,
    });
  }

  if (item.reason.trim()) {
    return item;
  }

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: buildTreeItemConnectionPrompt(tree, item),
    output: Output.object({
      name: "TreeItemConnection",
      description:
        "Connection metadata for a new Culture Tree item: a specific reason and connection type.",
      schema: TreeItemConnectionSchema,
    }),
  });

  return TreeItemSchema.parse({
    ...item,
    reason: result.output.reason,
    connectionType: result.output.connectionType,
  });
}
