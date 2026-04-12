import { anthropic } from "@ai-sdk/anthropic";
import {
  CultureTreeSchema,
  TreeRequestSchema,
  type CultureTree,
  type TreeRequest,
} from "@repo/schemas";
import { generateText, Output } from "ai";

import { SYSTEM_PROMPT, buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from "./prompts";

const model = anthropic("claude-sonnet-4-20250514");

async function generatePass(system: string, prompt: string): Promise<CultureTree> {
  const result = await generateText({
    model,
    output: Output.object({ schema: CultureTreeSchema }),
    system,
    prompt,
  });
  return result.output;
}

export async function generateTree(request: TreeRequest): Promise<CultureTree> {
  const data = TreeRequestSchema.parse(request);
  const { query, depth, mediaFilter, tone } = data;

  const depthConfig = {
    shallow: { branches: "3-4", children: "1" },
    standard: { branches: "4-6", children: "1-2" },
    deep: { branches: "5-7", children: "2-3" },
  }[depth];

  const pass1 = await generatePass(
    SYSTEM_PROMPT,
    buildPass1Prompt(query, depthConfig, mediaFilter, tone),
  );

  if (depth === "shallow") return pass1;

  const pass2 = await generatePass(SYSTEM_PROMPT, buildPass2Prompt(query, pass1, tone));

  if (depth === "standard") return pass2;

  return await generatePass(SYSTEM_PROMPT, buildPass3Prompt(query, pass2));
}
