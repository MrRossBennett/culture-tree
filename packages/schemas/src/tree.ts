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
export const ExternalNodeSource = z.enum(["tmdb", "wikipedia", "google-books", "musicbrainz"]);
export const GuideSectionId = z.enum([
  "start-here",
  "more-like-this",
  "join-the-dots",
  "go-sideways",
  "go-deeper",
]);
export const BranchRole = z.enum([
  "essential-next",
  "similar-appetite",
  "documented-context",
  "sideways-path",
  "deep-cut",
]);

export const CORE_RECOMMENDATION_GUIDE_SECTION_IDS = [
  "start-here",
  "more-like-this",
  "go-sideways",
  "go-deeper",
] as const satisfies readonly GuideSectionIdValue[];

export const GUIDE_SECTION_DISPLAY_ORDER = [
  "start-here",
  "more-like-this",
  "join-the-dots",
  "go-sideways",
  "go-deeper",
] as const satisfies readonly GuideSectionIdValue[];

const GUIDE_SECTION_BRANCH_ROLE: Record<GuideSectionIdValue, BranchRoleValue> = {
  "start-here": "essential-next",
  "more-like-this": "similar-appetite",
  "join-the-dots": "documented-context",
  "go-sideways": "sideways-path",
  "go-deeper": "deep-cut",
};

export function branchRoleForGuideSection(id: GuideSectionIdValue): BranchRoleValue {
  return GUIDE_SECTION_BRANCH_ROLE[id];
}

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
  url: z.url().optional(),
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
export type GuideSectionIdValue = z.infer<typeof GuideSectionId>;
export type BranchRoleValue = z.infer<typeof BranchRole>;
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
  branchRole?: BranchRoleValue;
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
  branchRole: BranchRole.optional(),
  searchHint: SearchHintSchema,
  identity: TreeNodeIdentitySchema.optional(),
  snapshot: TreeNodeSnapshotSchema.optional(),
  source: NodeSource.default("ai"),
});

export const GuideSectionSchema = z.object({
  id: GuideSectionId,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  items: z.array(TreeItemSchema),
});

export const CultureTreeSchema = z
  .object({
    seed: z.string().trim().min(1),
    seedType: z.literal("root").or(NodeType),
    guideSections: z.array(GuideSectionSchema).default([]),
    items: z.array(TreeItemSchema).default([]),
  })
  .superRefine((tree, ctx) => {
    if (tree.guideSections.length === 0) {
      return;
    }

    const sectionIds = tree.guideSections.map((section) => section.id);
    const sectionIdSet = new Set(sectionIds);

    for (const requiredId of CORE_RECOMMENDATION_GUIDE_SECTION_IDS) {
      if (!sectionIdSet.has(requiredId)) {
        ctx.addIssue({
          code: "custom",
          message: `Culture Tree Guide Sections must include ${formatGuideSectionTitle(requiredId)}.`,
          path: ["guideSections"],
        });
      }
    }

    for (const [index, section] of tree.guideSections.entries()) {
      if (sectionIds.indexOf(section.id) !== index) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate Guide Section ${formatGuideSectionTitle(section.id)}.`,
          path: ["guideSections", index, "id"],
        });
      }

      const expectedRole = GUIDE_SECTION_BRANCH_ROLE[section.id];
      for (const [itemIndex, item] of section.items.entries()) {
        if (item.branchRole !== expectedRole) {
          ctx.addIssue({
            code: "custom",
            message: `${formatGuideSectionTitle(section.id)} Branches must use ${expectedRole}.`,
            path: ["guideSections", index, "items", itemIndex, "branchRole"],
          });
        }
      }
    }

    const seenItemIds = new Set<string>();
    for (const [sectionIndex, section] of tree.guideSections.entries()) {
      for (const [itemIndex, item] of section.items.entries()) {
        if (seenItemIds.has(item.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate Branch ${item.id} across Guide Sections.`,
            path: ["guideSections", sectionIndex, "items", itemIndex, "id"],
          });
        }
        seenItemIds.add(item.id);
      }
    }

    const actualOrder = sectionIds.map((id) => GUIDE_SECTION_DISPLAY_ORDER.indexOf(id));
    const sortedOrder = [...actualOrder].sort((a, b) => a - b);
    if (!actualOrder.every((order, index) => order === sortedOrder[index])) {
      ctx.addIssue({
        code: "custom",
        message: "Guide Sections must use the fixed display order.",
        path: ["guideSections"],
      });
    }
  });

export type CultureTree = z.infer<typeof CultureTreeSchema>;
export type GuideSection = z.infer<typeof GuideSectionSchema>;

/** Total Branches in the tree, plus the Seed. */
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
  const guideSections = tree.guideSections.map((section) => ({
    ...section,
    items: section.items.map(finalizeItemSearchHints),
  }));
  const sectionItems = flattenGuideSectionItems(guideSections);

  return {
    ...tree,
    guideSections,
    items:
      tree.items.length > 0
        ? tree.items.map(finalizeItemSearchHints)
        : sectionItems.map(finalizeItemSearchHints),
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
  const roleResult = BranchRole.safeParse(o.branchRole);
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
    branchRole: roleResult.success ? roleResult.data : undefined,
    searchHint,
    identity: o.identity,
    snapshot: o.snapshot,
    source,
  });
}

function flattenGuideSectionItems(sections: readonly GuideSection[]): TreeItem[] {
  return sections.flatMap((section) => section.items);
}

function normalizeGuideSections(raw: unknown): GuideSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenItemIds = new Set<string>();
  const sections = raw
    .map((section) => {
      const o = section && typeof section === "object" ? (section as Record<string, unknown>) : {};
      const idResult = GuideSectionId.safeParse(o.id);
      if (!idResult.success) {
        return null;
      }

      const rawItems = Array.isArray(o.items) ? o.items : [];
      const expectedRole = GUIDE_SECTION_BRANCH_ROLE[idResult.data];
      const items = rawItems
        .map((item, index) => normalizeTreeItem(item, index))
        .filter((item) => {
          if (seenItemIds.has(item.id)) {
            return false;
          }
          seenItemIds.add(item.id);
          return true;
        })
        .map((item) => ({ ...item, branchRole: expectedRole }));

      return GuideSectionSchema.parse({
        id: idResult.data,
        title:
          typeof o.title === "string" && o.title.trim().length > 0
            ? o.title.trim()
            : formatGuideSectionTitle(idResult.data),
        description:
          typeof o.description === "string" && o.description.trim().length > 0
            ? o.description.trim()
            : undefined,
        items,
      });
    })
    .filter((section): section is GuideSection => section != null);

  return sections.sort(
    (a, b) => GUIDE_SECTION_DISPLAY_ORDER.indexOf(a.id) - GUIDE_SECTION_DISPLAY_ORDER.indexOf(b.id),
  );
}

export function formatGuideSectionTitle(id: GuideSectionIdValue): string {
  switch (id) {
    case "start-here":
      return "Start Here";
    case "more-like-this":
      return "More Like This";
    case "join-the-dots":
      return "Join The Dots";
    case "go-sideways":
      return "Go Sideways";
    case "go-deeper":
      return "Go Deeper";
  }
}

/** Model output can be partial or malformed; coerce into a valid {@link CultureTree}. */
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

  const rawItems = Array.isArray(o.items) ? o.items : [];
  const guideSections = normalizeGuideSections(o.guideSections);

  const items: unknown[] =
    rawItems.length > 0
      ? rawItems
      : guideSections.length > 0
        ? flattenGuideSectionItems(guideSections)
        : [];

  const coerced = CultureTreeSchema.parse({
    seed: legacySeed,
    seedType,
    guideSections,
    items: items.map((item, index) => normalizeTreeItem(item, index)),
  });

  return finalizeSearchHints(coerced);
}

export function acceptCultureTreeGenerationOutput(input: {
  output: unknown;
  seedLabel: string;
}): CultureTree {
  return normalizeCultureTreeOutput(input.output, input.seedLabel);
}
