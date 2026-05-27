import { db } from "@repo/db";
import { cultureTree } from "@repo/db/schema";
import { CultureTreeSchema } from "@repo/schemas";
import { eq } from "drizzle-orm";

import {
  parseTreeEnrichments,
  prepareEnrichmentsForCommittedBranches,
  resolveCommittedBranches,
} from "../src/server/committed-branch-enrichment";

const treeId = process.argv[2]?.trim();

if (!treeId) {
  throw new Error("Usage: pnpm --filter @repo/web enrich:tree <tree-id>");
}

const [row] = await db
  .select({
    data: cultureTree.data,
    enrichmentData: cultureTree.enrichmentData,
  })
  .from(cultureTree)
  .where(eq(cultureTree.id, treeId))
  .limit(1);

if (!row) {
  throw new Error(`Culture Tree not found: ${treeId}`);
}

const tree = CultureTreeSchema.parse(row.data);
const enrichments = await prepareEnrichmentsForCommittedBranches({
  tree,
  branches: tree.items,
  currentEnrichments: parseTreeEnrichments(row.enrichmentData),
  forceRefresh: true,
});

await db.update(cultureTree).set({ enrichmentData: enrichments }).where(eq(cultureTree.id, treeId));
await resolveCommittedBranches({ treeId, branches: tree.items, enrichments });

console.log(`Enriched ${tree.items.length} branches for Culture Tree ${treeId}.`);
