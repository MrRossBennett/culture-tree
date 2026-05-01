import { ENTITLEMENTS, PLANS } from "@repo/entitlements";
import { describe, expect, it } from "vite-plus/test";

import { decideGenerateTreeAllowance } from "./allowance-gates";

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
    });

    expect(result).toEqual({
      allowed: true,
      effectivePlan: PLANS.pro,
      usageType: ENTITLEMENTS.generateTree,
      remaining: null,
    });
  });
});
