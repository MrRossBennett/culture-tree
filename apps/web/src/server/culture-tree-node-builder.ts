import {
  ConnectionType,
  deriveSearchHintFromName,
  ExternalNodeSearchResultSchema,
  NodeType,
  TreeItemSchema,
  type TreeItem,
} from "@repo/schemas";
import { nanoid } from "nanoid";
import { z } from "zod";

export const ConceptNodeDraftSchema = z.object({
  kind: z.literal("concept"),
  name: z.string().trim().min(1),
  type: NodeType,
  connectionType: ConnectionType,
  reason: z.string().trim(),
  year: z.number().int().optional(),
});

export const SearchSelectedNodeDraftSchema = z.object({
  kind: z.literal("search-result"),
  result: ExternalNodeSearchResultSchema,
  connectionType: ConnectionType,
  reason: z.string().trim(),
});

export const AddCultureTreeNodeDraftSchema = z.discriminatedUnion("kind", [
  ConceptNodeDraftSchema,
  SearchSelectedNodeDraftSchema,
]);

export type AddCultureTreeNodeDraft = z.infer<typeof AddCultureTreeNodeDraftSchema>;

/**
 * Precedence for selected results:
 * `identity` is canonical, `snapshot` is stable rendering, `searchHint` is enrichment glue.
 */
export function buildCultureTreeNode(input: AddCultureTreeNodeDraft): TreeItem {
  const reason = input.reason.trim();

  if (input.kind === "concept") {
    const name = input.name.trim();
    return TreeItemSchema.parse({
      id: nanoid(),
      name,
      type: input.type,
      connectionType: input.connectionType,
      reason,
      year: input.year,
      source: "user",
      searchHint: deriveSearchHintFromName(name, input.type),
    });
  }

  const { identity, searchHint, snapshot } = input.result;
  return TreeItemSchema.parse({
    id: nanoid(),
    name: snapshot.name,
    type: snapshot.type,
    year: snapshot.year,
    reason,
    connectionType: input.connectionType,
    searchHint,
    identity,
    snapshot,
    source: "user",
  });
}
