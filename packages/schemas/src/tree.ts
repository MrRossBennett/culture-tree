import { z } from "zod";

export const NodeType = z.enum([
  "book",
  "album",
  "film",
  "tv",
  "artist",
  "podcast",
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

export const SearchHintSchema = z.object({
  title: z.string(),
  creator: z.string().optional(),
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
export type SearchHint = z.infer<typeof SearchHintSchema>;

export interface TreeNode {
  name: string;
  type: NodeTypeValue;
  year?: number;
  reason: string;
  connectionType: ConnectionTypeValue;
  searchHint: SearchHint;
  children: TreeNode[];
}

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: NodeType,
    year: z.number().optional(),
    reason: z.string(),
    connectionType: ConnectionType,
    searchHint: SearchHintSchema,
    children: z.array(TreeNodeSchema).default([]),
  }),
);

export const CultureTreeSchema = z.object({
  name: z.string(),
  type: z.literal("root").or(NodeType),
  year: z.number().optional(),
  reason: z.string().default(""),
  searchHint: SearchHintSchema,
  children: z.array(TreeNodeSchema),
});

export type CultureTree = z.infer<typeof CultureTreeSchema>;
