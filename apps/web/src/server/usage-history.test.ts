import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { describe, expect, it } from "vite-plus/test";

import { buildAcceptedAiGenerationUsage, usageTypeForGenerateTreeAction } from "./usage-history";

describe("Usage History", () => {
  it("records accepted direct Generate Tree usage with the person's Effective Plan", () => {
    const usage = buildAcceptedAiGenerationUsage({
      id: "usage_123",
      person: { id: "person_123", email: "free@example.com" },
      cultureTreeId: "tree_123",
      usageType: ENTITLEMENTS.generateTree,
      proAllowlist: [],
      now: new Date("2026-04-30T09:00:00.000Z"),
    });

    expect(usage).toEqual({
      id: "usage_123",
      personId: "person_123",
      usageType: "generate_tree",
      effectivePlan: PLANS.free,
      cultureTreeId: "tree_123",
      allowancePeriodStart: null,
      allowancePeriodEnd: null,
      createdAt: new Date("2026-04-30T09:00:00.000Z"),
    });
  });

  it("records Generate Tree from a Branch as the same Usage Type", () => {
    expect(usageTypeForGenerateTreeAction("direct_generate_tree")).toBe("generate_tree");
    expect(usageTypeForGenerateTreeAction("generate_tree_from_branch")).toBe("generate_tree");
  });

  it("records paid Allowance Period when one applies", () => {
    const usage = buildAcceptedAiGenerationUsage({
      id: "usage_456",
      person: { id: "person_456", email: "pro@example.com" },
      cultureTreeId: "tree_456",
      usageType: ENTITLEMENTS.generateTree,
      proAllowlist: "pro@example.com",
      allowancePeriod: {
        start: new Date("2026-04-01T00:00:00.000Z"),
        end: new Date("2026-05-01T00:00:00.000Z"),
      },
      now: new Date("2026-04-30T09:00:00.000Z"),
    });

    expect(usage).toMatchObject({
      effectivePlan: PLANS.pro,
      allowancePeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      allowancePeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
    });
  });

  it("does not create a new Usage History record for Retry Generation", () => {
    expect(usageTypeForGenerateTreeAction("retry_generation")).toBe(null);
  });
});
