import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { describe, expect, it } from "vite-plus/test";

import { decideGenerateTreeAllowance, decideGrowBranchAllowance } from "./allowance-gates";

describe("Generate Tree Allowance Gate", () => {
  it("allows a Free Plan person below the lifetime Generate Tree allowance", () => {
    const result = decideGenerateTreeAllowance({
      person: { email: "free@example.com" },
      generatedTreeUsageCount: 2,
    });

    expect(result).toEqual({
      allowed: true,
      effectivePlan: PLANS.free,
      usageType: ENTITLEMENTS.generateTree,
      remaining: 1,
    });
  });

  it("blocks a Free Plan person once lifetime Generate Tree usage is exhausted", () => {
    const result = decideGenerateTreeAllowance({
      person: { email: "free@example.com" },
      generatedTreeUsageCount: 3,
    });

    expect(result).toEqual({
      allowed: false,
      effectivePlan: PLANS.free,
      limitReached: {
        code: "limit_reached",
        allowance: "free_lifetime_generate_tree",
        usageType: ENTITLEMENTS.generateTree,
        limit: 3,
        used: 3,
        remaining: 0,
        message: "Free Plan includes 3 generated Culture Trees.",
      },
    });
  });

  it("does not apply the Free Plan lifetime Generate Tree allowance to Pro Plan people", () => {
    const result = decideGenerateTreeAllowance({
      person: { email: "pro@example.com" },
      proAllowlist: "pro@example.com",
      generatedTreeUsageCount: 99,
      paidAiGenerationUsageCountForAllowancePeriod: 99,
    });

    expect(result).toEqual({
      allowed: true,
      effectivePlan: PLANS.pro,
      usageType: ENTITLEMENTS.generateTree,
      remaining: 1,
    });
  });

  it("blocks Pro Generate Tree when shared paid AI Generation allowance is exhausted", () => {
    const result = decideGenerateTreeAllowance({
      person: { email: "pro@example.com" },
      proAllowlist: "pro@example.com",
      generatedTreeUsageCount: 0,
      paidAiGenerationUsageCountForAllowancePeriod: 100,
    });

    expect(result).toEqual({
      allowed: false,
      effectivePlan: PLANS.pro,
      limitReached: {
        code: "limit_reached",
        allowance: "pro_shared_ai_generation",
        usageType: ENTITLEMENTS.generateTree,
        limit: 100,
        used: 100,
        remaining: 0,
        message: "Pro Plan AI Generation Allowance is exhausted for the current Allowance Period.",
      },
    });
  });
});

describe("Grow Branch Allowance Gate", () => {
  it("allows a Free Plan person below the per-tree Grow Branch allowance", () => {
    const result = decideGrowBranchAllowance({
      person: { email: "free@example.com" },
      growBranchUsageCountForCultureTree: 2,
    });

    expect(result).toEqual({
      allowed: true,
      effectivePlan: PLANS.free,
      usageType: ENTITLEMENTS.growBranch,
      remaining: 1,
    });
  });

  it("blocks a Free Plan person once per-tree Grow Branch usage is exhausted", () => {
    const result = decideGrowBranchAllowance({
      person: { email: "free@example.com" },
      growBranchUsageCountForCultureTree: 3,
    });

    expect(result).toEqual({
      allowed: false,
      effectivePlan: PLANS.free,
      limitReached: {
        code: "limit_reached",
        allowance: "free_per_tree_grow_branch",
        usageType: ENTITLEMENTS.growBranch,
        limit: 3,
        used: 3,
        remaining: 0,
        message: "Free Plan includes 3 Grow Branch actions per Culture Tree.",
      },
    });
  });

  it("does not apply the Free Plan per-tree Grow Branch allowance to Pro Plan people", () => {
    const result = decideGrowBranchAllowance({
      person: { email: "pro@example.com" },
      proAllowlist: "pro@example.com",
      growBranchUsageCountForCultureTree: 99,
      paidAiGenerationUsageCountForAllowancePeriod: 99,
    });

    expect(result).toEqual({
      allowed: true,
      effectivePlan: PLANS.pro,
      usageType: ENTITLEMENTS.growBranch,
      remaining: 1,
    });
  });

  it("blocks Pro Grow Branch when shared paid AI Generation allowance is exhausted", () => {
    const result = decideGrowBranchAllowance({
      person: { email: "pro@example.com" },
      proAllowlist: "pro@example.com",
      growBranchUsageCountForCultureTree: 0,
      paidAiGenerationUsageCountForAllowancePeriod: 100,
    });

    expect(result).toEqual({
      allowed: false,
      effectivePlan: PLANS.pro,
      limitReached: {
        code: "limit_reached",
        allowance: "pro_shared_ai_generation",
        usageType: ENTITLEMENTS.growBranch,
        limit: 100,
        used: 100,
        remaining: 0,
        message: "Pro Plan AI Generation Allowance is exhausted for the current Allowance Period.",
      },
    });
  });
});
