import {
  ConnectionType,
  deriveSearchHintFromName,
  ExternalNodeSearchResultSchema,
  NodeType,
  TreeNodeSchema,
  type TreeNode,
} from "@repo/schemas";
import { z } from "zod";

export const ConceptNodeDraftSchema = z.object({
  kind: z.literal("concept"),
  name: z.string().trim().min(1),
  type: NodeType,
  connectionType: ConnectionType,
  reason: z.string().trim().min(1),
  year: z.number().int().optional(),
});

export const SearchSelectedNodeDraftSchema = z.object({
  kind: z.literal("search-result"),
  result: ExternalNodeSearchResultSchema,
  connectionType: ConnectionType,
  reason: z.string().trim().min(1),
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
export function buildCultureTreeNode(input: AddCultureTreeNodeDraft): TreeNode {
  const reason = input.reason.trim();

  if (input.kind === "concept") {
    const name = input.name.trim();
    return TreeNodeSchema.parse({
      name,
      type: input.type,
      connectionType: input.connectionType,
      reason,
      year: input.year,
      source: "user",
      searchHint: deriveSearchHintFromName(name, input.type),
      children: [],
    });
  }

  const { identity, searchHint, snapshot } = input.result;
  return TreeNodeSchema.parse({
    name: snapshot.name,
    type: snapshot.type,
    year: snapshot.year,
    reason,
    connectionType: input.connectionType,
    searchHint,
    identity,
    snapshot,
    source: "user",
    children: [],
  });
}
