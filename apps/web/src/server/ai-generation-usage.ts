import { db } from "@repo/db";
import { usageHistory } from "@repo/db/schema";
import { AI_GENERATION_USAGE_TYPES, ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";

import {
  decideGenerateTreeAllowance,
  decideGrowBranchAllowance,
  type GenerateTreeAllowanceResult,
  type GrowBranchAllowanceResult,
} from "./allowance-gates";
import { currentAllowancePeriod, type AllowancePeriod } from "./usage-history";

type GenerationPerson = {
  id: string;
  email?: string | null;
};

export type GenerateTreeAllowanceDecision = {
  allowance: GenerateTreeAllowanceResult;
  allowancePeriod: AllowancePeriod;
};

export type GrowBranchAllowanceDecision = {
  allowance: GrowBranchAllowanceResult;
  allowancePeriod: AllowancePeriod;
};

export async function countGeneratedTreeUsage(personId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageHistory)
    .where(
      and(
        eq(usageHistory.personId, personId),
        eq(usageHistory.usageType, ENTITLEMENTS.generateTree),
      ),
    )
    .limit(1);

  return row?.value ?? 0;
}

export async function countGrowBranchUsage(input: {
  personId: string;
  cultureTreeId: string;
}): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageHistory)
    .where(
      and(
        eq(usageHistory.personId, input.personId),
        eq(usageHistory.cultureTreeId, input.cultureTreeId),
        eq(usageHistory.usageType, ENTITLEMENTS.growBranch),
      ),
    )
    .limit(1);

  return row?.value ?? 0;
}

export async function countPaidAiGenerationUsage(input: {
  personId: string;
  allowancePeriod: AllowancePeriod;
}): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageHistory)
    .where(
      and(
        eq(usageHistory.personId, input.personId),
        eq(usageHistory.effectivePlan, PLANS.pro),
        inArray(usageHistory.usageType, [...AI_GENERATION_USAGE_TYPES]),
        gte(usageHistory.createdAt, input.allowancePeriod.start),
        lt(usageHistory.createdAt, input.allowancePeriod.end),
      ),
    )
    .limit(1);

  return row?.value ?? 0;
}

export async function prepareGenerateTreeAllowanceDecision(input: {
  person: GenerationPerson;
  proAllowlist?: string | readonly string[] | null;
}): Promise<GenerateTreeAllowanceDecision> {
  const allowancePeriod = currentAllowancePeriod();
  const allowance = decideGenerateTreeAllowance({
    person: input.person,
    proAllowlist: input.proAllowlist,
    generatedTreeUsageCount: await countGeneratedTreeUsage(input.person.id),
    paidAiGenerationUsageCountForAllowancePeriod: await countPaidAiGenerationUsage({
      personId: input.person.id,
      allowancePeriod,
    }),
  });

  return { allowance, allowancePeriod };
}

export async function prepareGrowBranchAllowanceDecision(input: {
  person: GenerationPerson;
  cultureTreeId: string;
  proAllowlist?: string | readonly string[] | null;
}): Promise<GrowBranchAllowanceDecision> {
  const allowancePeriod = currentAllowancePeriod();
  const allowance = decideGrowBranchAllowance({
    person: input.person,
    proAllowlist: input.proAllowlist,
    growBranchUsageCountForCultureTree: await countGrowBranchUsage({
      personId: input.person.id,
      cultureTreeId: input.cultureTreeId,
    }),
    paidAiGenerationUsageCountForAllowancePeriod: await countPaidAiGenerationUsage({
      personId: input.person.id,
      allowancePeriod,
    }),
  });

  return { allowance, allowancePeriod };
}
