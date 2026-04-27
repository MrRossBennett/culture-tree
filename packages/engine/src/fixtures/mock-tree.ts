import {
  CultureTreeSchema,
  TreeRequestSchema,
  type CultureTree,
  type TreeRequest,
} from "@repo/schemas";

import grimyNewYork from "../../fixtures/grimy-new-york-70s-standard.json";
import okComputer from "../../fixtures/ok-computer-standard.json";

const FIXTURE_RAW: Record<string, unknown> = {
  "ok-computer-standard": okComputer,
  "grimy-new-york-70s-standard": grimyNewYork,
};

function slugify(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolved culture tree for UI/dev when {@link generateTree} runs with `MOCK_ENGINE=true`.
 * Matches `slug(query)-depth` against committed fixtures, then same slug at `standard`, then Ok Computer.
 */
export function mockCultureTreeForRequest(request: TreeRequest): CultureTree {
  const data = TreeRequestSchema.parse(request);
  const slug = slugify(data.query);
  let key = `${slug}-${data.depth}`;
  if (!(key in FIXTURE_RAW)) {
    key = `${slug}-standard`;
  }
  if (!(key in FIXTURE_RAW)) {
    key = "ok-computer-standard";
  }
  const tree = CultureTreeSchema.parse(FIXTURE_RAW[key]);
  if (!data.mediaFilter?.length) {
    return tree;
  }

  const allowedTypes = new Set(data.mediaFilter);
  return CultureTreeSchema.parse({
    ...tree,
    items: tree.items.filter((item) => allowedTypes.has(item.type)),
  });
}
