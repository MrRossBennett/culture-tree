export const PLANS = {
  free: "free",
  pro: "pro",
} as const;

export type PlanKey = (typeof PLANS)[keyof typeof PLANS];

export const ENTITLEMENTS = {
  generateTree: "generate_tree",
  growBranch: "grow_branch",
} as const;

export type Entitlement = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

export const AI_GENERATION_USAGE_TYPES = [
  ENTITLEMENTS.generateTree,
  ENTITLEMENTS.growBranch,
] as const;

export type AiGenerationUsageType = (typeof AI_GENERATION_USAGE_TYPES)[number];

export type PlanConfig = {
  key: PlanKey;
  label: string;
  entitlements: readonly Entitlement[];
  allowances: {
    lifetimeGenerateTree: number | null;
    growBranchPerCultureTree: number | null;
    sharedAiGenerationsPerAllowancePeriod: number | null;
  };
};

const SHARED_PRO_AI_GENERATIONS_PER_ALLOWANCE_PERIOD = 100;

export const PLAN_CONFIG = {
  [PLANS.free]: {
    key: PLANS.free,
    label: "Free Plan",
    entitlements: [ENTITLEMENTS.generateTree, ENTITLEMENTS.growBranch],
    allowances: {
      lifetimeGenerateTree: 3,
      growBranchPerCultureTree: 3,
      sharedAiGenerationsPerAllowancePeriod: null,
    },
  },
  [PLANS.pro]: {
    key: PLANS.pro,
    label: "Pro Plan",
    entitlements: [ENTITLEMENTS.generateTree, ENTITLEMENTS.growBranch],
    allowances: {
      lifetimeGenerateTree: null,
      growBranchPerCultureTree: null,
      sharedAiGenerationsPerAllowancePeriod: SHARED_PRO_AI_GENERATIONS_PER_ALLOWANCE_PERIOD,
    },
  },
} as const satisfies Record<PlanKey, PlanConfig>;

export type EffectivePlan = (typeof PLAN_CONFIG)[PlanKey];

export type ProAllowlistSource = string | readonly string[] | null | undefined;

export type ResolveEffectivePlanInput = {
  person: { email?: string | null } | null | undefined;
  proAllowlist?: ProAllowlistSource;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function parseProAllowlist(source: ProAllowlistSource): string[] {
  const values = typeof source === "string" ? source.split(/[,\s]+/) : (source ?? []);

  return [
    ...new Set(values.map((email) => normalizeEmail(email)).filter((email) => email != null)),
  ];
}

export function resolveEffectivePlan(input: ResolveEffectivePlanInput): EffectivePlan {
  const email = normalizeEmail(input.person?.email);

  if (email && parseProAllowlist(input.proAllowlist).includes(email)) {
    return PLAN_CONFIG.pro;
  }

  return PLAN_CONFIG.free;
}
