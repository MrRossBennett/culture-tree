import { CultureTreeSchema, NodeType, TreeRequestSchema } from "@repo/schemas";
import { z } from "zod";

export const GenerationStatusSchema = z.enum(["queued", "running", "revealing", "ready", "failed"]);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const GenerationMetadataSchema = z.object({
  status: GenerationStatusSchema,
  runId: z.string().nullable(),
  stage: z.string().nullable(),
  updatedAt: z.date(),
  error: z.string().nullable(),
  hasFinalResult: z.boolean(),
});
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

export const GenerationMediaFilterSchema = z.array(NodeType);

export const GenerationFinalDataSchema = CultureTreeSchema.nullable();

export const StartGenerationInputSchema = TreeRequestSchema;

export type StartGenerationInput = z.infer<typeof StartGenerationInputSchema>;

export const ACTIVE_GENERATION_STATUSES: readonly GenerationStatus[] = [
  "queued",
  "running",
  "revealing",
];

export function isGenerationTerminal(status: GenerationStatus): boolean {
  return status === "ready" || status === "failed";
}

export function isGenerationActive(status: GenerationStatus): boolean {
  return ACTIVE_GENERATION_STATUSES.includes(status);
}

export function staleGenerationCutoff(now = new Date()): Date {
  return new Date(now.getTime() - 5 * 60 * 1000);
}

export function isGenerationStale(
  metadata: Pick<GenerationMetadata, "status" | "updatedAt">,
  now = new Date(),
): boolean {
  return isGenerationActive(metadata.status) && metadata.updatedAt <= staleGenerationCutoff(now);
}

export function draftTreeForSeed(seedQuery: string) {
  return CultureTreeSchema.parse({
    seed: seedQuery.trim(),
    seedType: "root",
    items: [],
  });
}

export function parseGenerationMetadata(row: {
  generationStatus: string;
  generationRunId: string | null;
  generationStage: string | null;
  generationUpdatedAt: Date;
  generationError: string | null;
  generationFinalData: unknown;
}): GenerationMetadata {
  return GenerationMetadataSchema.parse({
    status: row.generationStatus,
    runId: row.generationRunId,
    stage: row.generationStage,
    updatedAt: row.generationUpdatedAt,
    error: row.generationError,
    hasFinalResult: row.generationFinalData != null,
  });
}

export function parseGenerationFinalData(value: unknown) {
  return GenerationFinalDataSchema.parse(value ?? null);
}

export function parseMediaFilter(value: unknown) {
  if (value == null) {
    return undefined;
  }

  const parsed = GenerationMediaFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function nextRevealItemIndex(currentItemCount: number): number {
  return currentItemCount;
}
