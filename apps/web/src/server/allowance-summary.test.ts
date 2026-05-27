import { PLANS } from "@repo/entitlements";
import { describe, expect, it } from "vite-plus/test";

import { buildAllowanceSummary } from "./allowance-summary";

describe("Allowance Summary", () => {
  it("returns Free Plan generated-tree usage and deletion note", () => {
    expect(
      buildAllowanceSummary({
        person: { email: "free@example.com" },
        treeCreationUsageCount: 2,
        generatedTreeUsageCount: 2,
        paidAiGenerationUsageCountForAllowancePeriod: 0,
        allowancePeriod: {
          start: new Date("2026-04-01T00:00:00.000Z"),
          end: new Date("2026-05-01T00:00:00.000Z"),
        },
      }),
    ).toEqual({
      effectivePlan: { key: PLANS.free, label: "Free Plan" },
      usage: {
        kind: "free",
        cultureTreesCreated: 2,
        treeCreationLimit: 3,
        generatedTreesUsed: 2,
        aiGeneratedTreeLimit: 3,
        growBranchPerCultureTree: 3,
        deletionDoesNotRestoreUsage: true,
      },
    });
  });

  it("returns Pro Plan shared AI Generation usage for the current Allowance Period", () => {
    expect(
      buildAllowanceSummary({
        person: { email: "pro@example.com" },
        proAllowlist: "pro@example.com",
        treeCreationUsageCount: 99,
        generatedTreeUsageCount: 99,
        paidAiGenerationUsageCountForAllowancePeriod: 12,
        allowancePeriod: {
          start: new Date("2026-04-01T00:00:00.000Z"),
          end: new Date("2026-05-01T00:00:00.000Z"),
        },
      }),
    ).toEqual({
      effectivePlan: { key: PLANS.pro, label: "Pro Plan" },
      usage: {
        kind: "pro",
        paidAiGenerationsUsed: 12,
        paidAiGenerationLimit: 100,
        allowancePeriodStart: "2026-04-01T00:00:00.000Z",
        allowancePeriodEnd: "2026-05-01T00:00:00.000Z",
      },
    });
  });
});
