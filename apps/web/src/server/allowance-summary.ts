import {
  PLAN_CONFIG,
  resolveEffectivePlan,
  type PlanKey,
  type ProAllowlistSource,
} from "@repo/entitlements";

import type { AllowancePeriod } from "./usage-history";

export type AllowanceSummary =
  | {
      effectivePlan: { key: PlanKey; label: string };
      usage: {
        kind: "free";
        cultureTreesCreated: number;
        treeCreationLimit: number | null;
        generatedTreesUsed: number;
        aiGeneratedTreeLimit: number | null;
        growBranchPerCultureTree: number | null;
        deletionDoesNotRestoreUsage: true;
      };
    }
  | {
      effectivePlan: { key: PlanKey; label: string };
      usage: {
        kind: "pro";
        paidAiGenerationsUsed: number;
        paidAiGenerationLimit: number | null;
        allowancePeriodStart: string;
        allowancePeriodEnd: string;
      };
    };

export type BuildAllowanceSummaryInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
  treeCreationUsageCount: number;
  generatedTreeUsageCount: number;
  paidAiGenerationUsageCountForAllowancePeriod: number;
  allowancePeriod: AllowancePeriod;
};

export function buildAllowanceSummary(input: BuildAllowanceSummaryInput): AllowanceSummary {
  const plan = resolveEffectivePlan({
    person: input.person,
    proAllowlist: input.proAllowlist,
  });

  if (plan.key === PLAN_CONFIG.free.key) {
    return {
      effectivePlan: { key: plan.key, label: plan.label },
      usage: {
        kind: "free",
        cultureTreesCreated: input.treeCreationUsageCount,
        treeCreationLimit: plan.allowances.lifetimeTreeCreations,
        generatedTreesUsed: input.generatedTreeUsageCount,
        aiGeneratedTreeLimit: plan.allowances.lifetimeGenerateTree,
        growBranchPerCultureTree: plan.allowances.growBranchPerCultureTree,
        deletionDoesNotRestoreUsage: true,
      },
    };
  }

  return {
    effectivePlan: { key: plan.key, label: plan.label },
    usage: {
      kind: "pro",
      paidAiGenerationsUsed: input.paidAiGenerationUsageCountForAllowancePeriod,
      paidAiGenerationLimit: plan.allowances.sharedAiGenerationsPerAllowancePeriod,
      allowancePeriodStart: input.allowancePeriod.start.toISOString(),
      allowancePeriodEnd: input.allowancePeriod.end.toISOString(),
    },
  };
}
