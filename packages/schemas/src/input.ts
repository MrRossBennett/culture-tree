import { z } from "zod";

import { NodeType } from "./tree";

export const TreeRequestSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(["shallow", "standard", "deep"]).default("standard"),
  mediaFilter: z.array(NodeType).optional(),
  tone: z.enum(["accessible", "deep-cuts", "mixed"]).default("mixed"),
});

export type TreeRequest = z.infer<typeof TreeRequestSchema>;
