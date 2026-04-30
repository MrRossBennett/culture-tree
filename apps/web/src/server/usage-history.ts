import {
  ENTITLEMENTS,
  resolveEffectivePlan,
  type AiGenerationUsageType,
  type ProAllowlistSource,
} from "@repo/entitlements";

export type GenerateTreeUsageAction =
  | "direct_generate_tree"
  | "generate_tree_from_branch"
  | "retry_generation";

export type UsageHistoryRecord = {
  id: string;
  personId: string;
  usageType: AiGenerationUsageType;
  effectivePlan: string;
  cultureTreeId: string;
  allowancePeriodStart: Date | null;
  allowancePeriodEnd: Date | null;
  createdAt: Date;
};

export type BuildAcceptedAiGenerationUsageInput = {
  id: string;
  person: { id: string; email?: string | null };
  cultureTreeId: string;
  usageType: AiGenerationUsageType;
  proAllowlist?: ProAllowlistSource;
  allowancePeriod?: { start: Date; end: Date } | null;
  now?: Date;
};

export function usageTypeForGenerateTreeAction(
  action: GenerateTreeUsageAction,
): AiGenerationUsageType | null {
  switch (action) {
    case "direct_generate_tree":
    case "generate_tree_from_branch":
      return ENTITLEMENTS.generateTree;
    case "retry_generation":
      return null;
  }
}

export function buildAcceptedAiGenerationUsage(
  input: BuildAcceptedAiGenerationUsageInput,
): UsageHistoryRecord {
  const plan = resolveEffectivePlan({
    person: input.person,
    proAllowlist: input.proAllowlist,
  });

  return {
    id: input.id,
    personId: input.person.id,
    usageType: input.usageType,
    effectivePlan: plan.key,
    cultureTreeId: input.cultureTreeId,
    allowancePeriodStart: input.allowancePeriod?.start ?? null,
    allowancePeriodEnd: input.allowancePeriod?.end ?? null,
    createdAt: input.now ?? new Date(),
  };
}
