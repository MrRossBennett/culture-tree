import { z } from "zod";

export const NodeType = z.enum([
  "book",
  "album",
  "song",
  "film",
  "tv",
  "artist",
  "podcast",
  "artwork",
  "place",
  "event",
  "person",
  "article",
]);

export const ConnectionType = z.enum([
  "influence",
  "collaboration",
  "thematic",
  "adaptation",
  "member",
  "response",
  "spiritual-kin",
  "birthplace",
  "catalyst",
  "documented-by",
  "frequented",
  "contemporary",
]);

export const NodeSource = z.enum(["ai", "user"]);
export const ExternalNodeSource = z.enum(["tmdb", "wikipedia", "google-books"]);

export const SearchHintSchema = z.object({
  title: z
    .string()
    .describe(
      "Title of the work or primary label for search (no creator bundled into this string).",
    ),
  creator: z
    .string()
    .optional()
    .describe(
      "Primary creator for APIs: author (books), artist/band (music), optional director for film/TV. Omit when not applicable (e.g. many places, standalone people nodes).",
    ),
  isbn: z.string().optional(),
  imdbId: z.string().optional(),
  wikiSlug: z.string().optional(),
  location: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

export type NodeTypeValue = z.infer<typeof NodeType>;
export type ConnectionTypeValue = z.infer<typeof ConnectionType>;
export type NodeSourceValue = z.infer<typeof NodeSource>;
export type ExternalNodeSourceValue = z.infer<typeof ExternalNodeSource>;
export type SearchHint = z.infer<typeof SearchHintSchema>;

export const TreeNodeIdentitySchema = z.object({
  source: ExternalNodeSource,
  externalId: z.string().trim().min(1),
});

export const TreeNodeSnapshotSchema = z.object({
  name: z.string().trim().min(1),
  type: NodeType,
  year: z.number().int().optional(),
  image: z.url().optional(),
});

export const ExternalNodeSearchResultSchema = z.object({
  identity: TreeNodeIdentitySchema,
  snapshot: TreeNodeSnapshotSchema,
  /**
   * Compatibility-only lookup data for current enrichment flows.
   * `identity` is canonical, `snapshot` is stable rendering, `searchHint` is lookup glue.
   */
  searchHint: SearchHintSchema,
  meta: z.string().optional(),
  externalUrl: z.url().optional(),
});

export type TreeNodeIdentity = z.infer<typeof TreeNodeIdentitySchema>;
export type TreeNodeSnapshot = z.infer<typeof TreeNodeSnapshotSchema>;
export type ExternalNodeSearchResult = z.infer<typeof ExternalNodeSearchResultSchema>;

export interface TreeItem {
  id: string;
  name: string;
  type: NodeTypeValue;
  year?: number;
  reason: string;
  connectionType: ConnectionTypeValue;
  searchHint: SearchHint;
  identity?: TreeNodeIdentity;
  snapshot?: TreeNodeSnapshot;
  source: NodeSourceValue;
}

export const TreeItemSchema: z.ZodType<TreeItem> = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: NodeType,
  year: z.number().int().optional(),
  reason: z.string(),
  connectionType: ConnectionType,
  searchHint: SearchHintSchema,
  identity: TreeNodeIdentitySchema.optional(),
  snapshot: TreeNodeSnapshotSchema.optional(),
  source: NodeSource.default("ai"),
});

export const CultureTreeSchema = z.object({
  seed: z.string().trim().min(1),
  seedType: z.literal("root").or(NodeType),
  items: z.array(TreeItemSchema),
});

export type CultureTree = z.infer<typeof CultureTreeSchema>;

/** Total nodes in the tree (seed plus all flat items). */
export function countCultureTreeNodes(tree: CultureTree): number {
  return 1 + tree.items.length;
}

const DEFAULT_ITEM_CONNECTION: ConnectionTypeValue = "thematic";

/** Model typos vs schema enum */
const CONNECTION_TYPE_ALIASES: Record<string, ConnectionTypeValue> = {
  "documentation-by": "documented-by",
};

/** Item types where title/creator are usually distinct fields for enrichment APIs. */
const SEARCH_HINT_SPLIT_TYPES = new Set<NodeTypeValue | "root">([
  "root",
  "book",
  "album",
  "song",
  "film",
  "tv",
  "podcast",
  "artwork",
]);

function trySplitTitleCreator(text: string): { title: string; creator: string } | null {
  const t = text.trim();
  if (!t) {
    return null;
  }

  const byMatch = t.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch?.[1] && byMatch[2]) {
    const title = byMatch[1].trim();
    const creator = byMatch[2].trim();
    if (title.length >= 2 && creator.length >= 2) {
      return { title, creator };
    }
  }

  const dashSplit = t.split(/\s*[—–]\s*/);
  if (dashSplit.length === 2) {
    const title = dashSplit[0].trim();
    const creator = dashSplit[1].trim();
    if (title.length >= 2 && creator.length >= 2) {
      return { title, creator };
    }
  }

  const hyphenSplit = t.split(/\s+-\s+/);
  if (hyphenSplit.length === 2) {
    const title = hyphenSplit[0].trim();
    const creator = hyphenSplit[1].trim();
    if (title.length >= 2 && creator.length >= 2) {
      return { title, creator };
    }
  }

  return null;
}

function normalizeSearchHint(
  raw: unknown,
  defaultTitle: string,
  nodeType: NodeTypeValue | "root",
): SearchHint {
  const parsed = SearchHintSchema.safeParse(raw);
  const splitOk = SEARCH_HINT_SPLIT_TYPES.has(nodeType);

  if (parsed.success) {
    const hint = parsed.data;
    if (splitOk && (!hint.creator || !hint.creator.trim()) && hint.title.trim().length > 0) {
      const split = trySplitTitleCreator(hint.title);
      if (split) {
        return SearchHintSchema.parse({
          ...hint,
          title: split.title,
          creator: split.creator,
        });
      }
    }
    return hint;
  }

  if (splitOk) {
    const fromName = trySplitTitleCreator(defaultTitle);
    if (fromName) {
      return SearchHintSchema.parse({
        title: fromName.title,
        creator: fromName.creator,
      });
    }
  }

  return { title: defaultTitle.trim() || "Untitled" };
}

export function deriveSearchHintFromName(
  name: string,
  nodeType: NodeTypeValue | "root",
): SearchHint {
  return normalizeSearchHint(undefined, name, nodeType);
}

function finalizeSearchHints(tree: CultureTree): CultureTree {
  return {
    ...tree,
    items: tree.items.map(finalizeItemSearchHints),
  };
}

function finalizeItemSearchHints(item: TreeItem): TreeItem {
  return {
    ...item,
    searchHint: normalizeSearchHint(item.searchHint, item.name, item.type),
  };
}

function fallbackItemId(index: number): string {
  return `item_${String(index + 1).padStart(3, "0")}`;
}

function normalizeTreeItem(raw: unknown, index: number): TreeItem {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = typeof o.name === "string" && o.name.trim().length > 0 ? o.name.trim() : "Untitled";
  const typeResult = NodeType.safeParse(o.type);
  const type = typeResult.success ? typeResult.data : "person";
  const reason = typeof o.reason === "string" ? o.reason : "";
  const rawConn = o.connectionType;
  const aliased = typeof rawConn === "string" ? CONNECTION_TYPE_ALIASES[rawConn] : undefined;
  const connResult = ConnectionType.safeParse(aliased ?? rawConn);
  const connectionType = connResult.success ? connResult.data : DEFAULT_ITEM_CONNECTION;
  const searchHint = normalizeSearchHint(o.searchHint, name, type);
  const sourceResult = NodeSource.safeParse(o.source);
  const source = sourceResult.success ? sourceResult.data : "ai";
  const id =
    typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim() : fallbackItemId(index);

  return TreeItemSchema.parse({
    id,
    name,
    type,
    year: typeof o.year === "number" ? o.year : undefined,
    reason,
    connectionType,
    searchHint,
    identity: o.identity,
    snapshot: o.snapshot,
    source,
  });
}

/**
 * Model output can be partial or malformed; coerce into a valid {@link CultureTree} for persistence.
 * Also tolerates the legacy nested tree shape by flattening descendants into `items`.
 */
export function normalizeCultureTreeOutput(raw: unknown, seedLabel: string): CultureTree {
  const fallbackSeed = seedLabel.trim() || "Culture tree";
  const parsed = CultureTreeSchema.safeParse(raw);
  if (parsed.success) {
    return finalizeSearchHints(parsed.data);
  }

  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacySeed =
    typeof o.name === "string" && o.name.trim().length > 0
      ? o.name.trim()
      : typeof o.seed === "string" && o.seed.trim().length > 0
        ? o.seed.trim()
        : fallbackSeed;

  let seedType: CultureTree["seedType"];
  if (o.seedType === "root" || o.type === "root") {
    seedType = "root";
  } else {
    const nt = NodeType.safeParse(o.seedType ?? o.type);
    seedType = nt.success ? nt.data : "root";
  }

  const legacyChildren = Array.isArray(o.children) ? o.children : [];
  const rawItems = Array.isArray(o.items) ? o.items : [];

  const items: unknown[] =
    rawItems.length > 0
      ? rawItems
      : legacyChildren.flatMap((child) => {
          const childObj =
            child && typeof child === "object" ? (child as Record<string, unknown>) : {};
          const descendants = Array.isArray(childObj.children) ? childObj.children : [];
          return [{ ...childObj, children: undefined }, ...descendants];
        });

  const coerced = CultureTreeSchema.parse({
    seed: legacySeed,
    seedType,
    items: items.map((item, index) => normalizeTreeItem(item, index)),
  });

  return finalizeSearchHints(coerced);
}
