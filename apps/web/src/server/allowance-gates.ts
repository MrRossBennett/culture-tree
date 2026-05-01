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

export type AllowanceLimitReached = GenerateTreeLimitReached | GrowBranchLimitReached;

export type GenerateTreeAllowanceResult =
  | {
      allowed: true;
      effectivePlan: PlanKey;
      usageType: typeof ENTITLEMENTS.generateTree;
      remaining: number | null;
    }
  | {
      allowed: false;
      effectivePlan: typeof PLANS.free;
      limitReached: GenerateTreeLimitReached;
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
      effectivePlan: typeof PLANS.free;
      limitReached: GrowBranchLimitReached;
    };

export type DecideGenerateTreeAllowanceInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
  generatedTreeUsageCount: number;
};

export type DecideGrowBranchAllowanceInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
  growBranchUsageCountForCultureTree: number;
};

export function decideGenerateTreeAllowance(
  input: DecideGenerateTreeAllowanceInput,
): GenerateTreeAllowanceResult {
  const plan = resolveEffectivePlan({
    person: input.person,
    proAllowlist: input.proAllowlist,
  });

  if (plan.key !== PLANS.free) {
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.generateTree,
      remaining: null,
    };
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
    return {
      allowed: true,
      effectivePlan: plan.key,
      usageType: ENTITLEMENTS.growBranch,
      remaining: null,
    };
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
