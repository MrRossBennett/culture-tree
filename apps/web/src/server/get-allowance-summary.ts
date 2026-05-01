import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { usageHistory } from "@repo/db/schema";
import { AI_GENERATION_USAGE_TYPES, ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";

import { buildAllowanceSummary } from "./allowance-summary";
import { currentAllowancePeriod, type AllowancePeriod } from "./usage-history";

async function countGeneratedTreeUsage(personId: string): Promise<number> {
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

async function countPaidAiGenerationUsage(input: {
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

export const $getAllowanceSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const allowancePeriod = currentAllowancePeriod();

    return buildAllowanceSummary({
      person: context.user,
      proAllowlist: process.env.PRO_ALLOWLIST,
      generatedTreeUsageCount: await countGeneratedTreeUsage(context.user.id),
      paidAiGenerationUsageCountForAllowancePeriod: await countPaidAiGenerationUsage({
        personId: context.user.id,
        allowancePeriod,
      }),
      allowancePeriod,
    });
  });
