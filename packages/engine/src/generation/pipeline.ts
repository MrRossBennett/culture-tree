import { anthropic } from "@ai-sdk/anthropic";
import {
  CultureTreeSchema,
  TreeRequestSchema,
  normalizeCultureTreeOutput,
  type CultureTree,
  type TreeRequest,
} from "@repo/schemas";
import { Output, generateText } from "ai";

import { mockCultureTreeForRequest } from "../fixtures/mock-tree";
import { SYSTEM_PROMPT, buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from "./prompts";

const model = anthropic("claude-sonnet-4-20250514");

async function generatePass(
  system: string,
  prompt: string,
  seedLabel: string,
): Promise<CultureTree> {
  const result = await generateText({
    model,
    system,
    prompt,
    output: Output.object({
      name: "CultureTree",
      description:
        "Culture connection tree: every item has searchHint.title (work title or primary label) and searchHint.creator (author/artist/etc.) as separate strings when the item type is a creative work.",
      schema: CultureTreeSchema,
    }),
  });
  return normalizeCultureTreeOutput(result.output, seedLabel);
}

export async function generateTree(request: TreeRequest): Promise<CultureTree> {
  if (process.env.MOCK_ENGINE === "true") {
    return mockCultureTreeForRequest(request);
  }

  const data = TreeRequestSchema.parse(request);
  const { query, depth, mediaFilter, tone } = data;

  const depthConfig = {
    shallow: { count: "6-8" },
    standard: { count: "10-14" },
    deep: { count: "16-20" },
  }[depth];

  const pass1 = await generatePass(
    SYSTEM_PROMPT,
    buildPass1Prompt(query, depthConfig, mediaFilter, tone),
    query,
  );

  if (depth === "shallow") return pass1;

  const pass2 = await generatePass(SYSTEM_PROMPT, buildPass2Prompt(query, pass1, tone), query);

  if (depth === "standard") return pass2;

  return await generatePass(SYSTEM_PROMPT, buildPass3Prompt(query, pass2), query);
}
