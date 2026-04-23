/**
 * Generate a CultureTree fixture via Claude (standard depth, mixed tone).
 *
 * Usage (from packages/engine):
 *   node --env-file=../../apps/web/.env --import tsx scripts/generate-fixture.ts "<query>" <filename.json>
 *
 * Example:
 *   node --env-file=../../apps/web/.env --import tsx scripts/generate-fixture.ts "Grimy New York 70s" grimy-new-york-70s-standard.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CultureTreeSchema } from "@repo/schemas";

import { generateTree } from "../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const keyOrder = ["seed", "seedType", "items"] as const;

function reorderNode(n: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keyOrder) {
    if (k === "items" && Array.isArray(n.items)) {
      out.items = (n.items as Record<string, unknown>[]).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        year: item.year,
        reason: item.reason,
        connectionType: item.connectionType,
        searchHint: item.searchHint,
        source: item.source,
      }));
    } else if (k !== "items" && k in n) {
      out[k] = n[k];
    }
  }
  return out;
}

export async function runFixture(query: string, fileName: string): Promise<void> {
  if (process.env.MOCK_ENGINE === "true") {
    console.error(
      "MOCK_ENGINE must be false when capturing fixtures (otherwise generateTree returns mock data). Unset it or run with MOCK_ENGINE=false.",
    );
    process.exit(1);
  }
  const raw = await generateTree({
    query,
    depth: "standard",
    tone: "mixed",
  });

  const tree = reorderNode(raw as Record<string, unknown>);
  CultureTreeSchema.parse(tree);

  const outPath = join(__dirname, "../fixtures", fileName);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(tree, null, 2)}\n`, "utf-8");
  console.log("Wrote", outPath);
}

function isFixtureCli(): boolean {
  const scriptPath = process.argv[1] ?? "";
  return scriptPath.endsWith("generate-fixture.ts");
}

if (isFixtureCli()) {
  const query = process.argv[2];
  const fileName = process.argv[3];
  if (!query || !fileName) {
    console.error(
      "Usage: generate-fixture.ts <query> <filename.json>\n" +
        'Example: generate-fixture.ts "Grimy New York 70s" grimy-new-york-70s-standard.json',
    );
    process.exit(1);
  }
  await runFixture(query, fileName);
}
