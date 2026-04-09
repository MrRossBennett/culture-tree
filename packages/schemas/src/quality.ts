import { z } from "zod";

import { ConnectionType, NodeType } from "./tree";

export const RatedConnectionSchema = z.object({
  id: z.string(),
  sourceQuery: z.string(),
  nodeName: z.string(),
  nodeType: NodeType,
  reason: z.string(),
  connectionType: ConnectionType,
  rating: z.number(),
  ratingCount: z.number(),
  addedToPrompt: z.boolean(),
});

export type RatedConnection = z.infer<typeof RatedConnectionSchema>;
