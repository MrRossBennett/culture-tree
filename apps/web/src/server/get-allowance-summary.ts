import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";

import { countGeneratedTreeUsage, countPaidAiGenerationUsage } from "./ai-generation-usage";
import { buildAllowanceSummary } from "./allowance-summary";
import { currentAllowancePeriod } from "./usage-history";

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
