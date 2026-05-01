import {
  ENTITLEMENTS,
  PLAN_CONFIG,
  PLANS,
  resolveEffectivePlan,
  type PlanKey,
  type ProAllowlistSource,
} from "@repo/entitlements";

export type GenerateTreeLimitReached = {
  code: "limit_reached";
  allowance: "free_lifetime_generate_tree";
  usageType: typeof ENTITLEMENTS.generateTree;
  limit: number;
  used: number;
  remaining: 0;
  message: string;
};

export type GrowBranchLimitReached = {
  code: "limit_reached";
  allowance: "free_per_tree_grow_branch";
  usageType: typeof ENTITLEMENTS.growBranch;
  limit: number;
  used: number;
  remaining: 0;
  message: string;
};

export type ProSharedAiGenerationLimitReached = {
  code: "limit_reached";
  allowance: "pro_shared_ai_generation";
  usageType: (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];
  limit: number;
  used: number;
  remaining: 0;
  message: string;
};

export type AllowanceLimitReached =
  | GenerateTreeLimitReached
  | GrowBranchLimitReached
  | ProSharedAiGenerationLimitReached;

export type GenerateTreeAllowanceResult =
  | {
      allowed: true;
      effectivePlan: PlanKey;
      usageType: typeof ENTITLEMENTS.generateTree;
      remaining: number | null;
    }
  | {
      allowed: false;
      effectivePlan: PlanKey;
      limitReached: GenerateTreeLimitReached | ProSharedAiGenerationLimitReached;
    };

export type GrowBranchAllowanceResult =
  | {
      allowed: true;
      effectivePlan: PlanKey;
      usageType: typeof ENTITLEMENTS.growBranch;
      remaining: number | null;
    }
  | {
      allowed: false;
      effectivePlan: PlanKey;
      limitReached: GrowBranchLimitReached | ProSharedAiGenerationLimitReached;
    };

export type DecideGenerateTreeAllowanceInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
  generatedTreeUsageCount: number;
  paidAiGenerationUsageCountForAllowancePeriod?: number;
};

export type DecideGrowBranchAllowanceInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
  growBranchUsageCountForCultureTree: number;
  paidAiGenerationUsageCountForAllowancePeriod?: number;
};

function decideProSharedAiGenerationAllowance<
  TUsageType extends (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS],
>(input: {
  usageType: TUsageType;
  used: number;
}):
  | {
      allowed: true;
      effectivePlan: typeof PLANS.pro;
      usageType: TUsageType;
      remaining: number | null;
    }
  | {
      allowed: false;
      effectivePlan: typeof PLANS.pro;
      limitReached: ProSharedAiGenerationLimitReached & { usageType: TUsageType };
    } {
  const limit = PLAN_CONFIG.pro.allowances.sharedAiGenerationsPerAllowancePeriod;
  if (limit == null) {
    return {
      allowed: true,
      effectivePlan: PLANS.pro,
      usageType: input.usageType,
      remaining: null,
    };
  }

  const remaining = Math.max(limit - input.used, 0);
  if (remaining > 0) {
    return {
      allowed: true,
      effectivePlan: PLANS.pro,
      usageType: input.usageType,
      remaining,
    };
  }

  return {
    allowed: false,
    effectivePlan: PLANS.pro,
    limitReached: {
      code: "limit_reached",
      allowance: "pro_shared_ai_generation",
      usageType: input.usageType,
      limit,
      used: input.used,
      remaining: 0,
      message: "Pro Plan AI Generation Allowance is exhausted for the current Allowance Period.",
    },
  };
}

export function decideGenerateTreeAllowance(
  input: DecideGenerateTreeAllowanceInput,
): GenerateTreeAllowanceResult {
  const plan = resolveEffectivePlan({
    person: input.person,
    proAllowlist: input.proAllowlist,
  });

  if (plan.key !== PLANS.free) {
    return decideProSharedAiGenerationAllowance({
      usageType: ENTITLEMENTS.generateTree,
      used: input.paidAiGenerationUsageCountForAllowancePeriod ?? 0,
    });
  }

  const limit = PLAN_CONFIG.free.allowances.lifetimeGenerateTree;
  if (limit == null) {
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.generateTree,
      remaining: null,
    };
  }

  const remaining = Math.max(limit - input.generatedTreeUsageCount, 0);
  if (remaining > 0) {
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.generateTree,
      remaining,
    };
  }

  return {
    allowed: false,
    effectivePlan: PLANS.free,
    limitReached: {
      code: "limit_reached",
      allowance: "free_lifetime_generate_tree",
      usageType: ENTITLEMENTS.generateTree,
      limit,
      used: input.generatedTreeUsageCount,
      remaining: 0,
      message: "Free Plan includes 3 generated Culture Trees.",
    },
  };
}

export function decideGrowBranchAllowance(
  input: DecideGrowBranchAllowanceInput,
): GrowBranchAllowanceResult {
  const plan = resolveEffectivePlan({
    person: input.person,
    proAllowlist: input.proAllowlist,
  });

  if (plan.key !== PLANS.free) {
    return decideProSharedAiGenerationAllowance({
      usageType: ENTITLEMENTS.growBranch,
      used: input.paidAiGenerationUsageCountForAllowancePeriod ?? 0,
    });
  }

  const limit = PLAN_CONFIG.free.allowances.growBranchPerCultureTree;
  if (limit == null) {
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.growBranch,
      remaining: null,
    };
  }

  const remaining = Math.max(limit - input.growBranchUsageCountForCultureTree, 0);
  if (remaining > 0) {
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.growBranch,
      remaining,
    };
  }

  return {
    allowed: false,
    effectivePlan: PLANS.free,
    limitReached: {
      code: "limit_reached",
      allowance: "free_per_tree_grow_branch",
      usageType: ENTITLEMENTS.growBranch,
      limit,
      used: input.growBranchUsageCountForCultureTree,
      remaining: 0,
      message: "Free Plan includes 3 Grow Branch actions per Culture Tree.",
    },
  };
}
