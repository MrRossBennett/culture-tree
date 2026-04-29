import { describe, expect, it } from "vite-plus/test";

import {
  AI_GENERATION_USAGE_TYPES,
  ENTITLEMENTS,
  PLAN_CONFIG,
  PLANS,
  parseProAllowlist,
  resolveEffectivePlan,
} from "./plans";

describe("Plan Configuration", () => {
  it("defines Free and Pro without implementing Patron", () => {
    expect(Object.keys(PLAN_CONFIG)).toEqual([PLANS.free, PLANS.pro]);
    expect(PLAN_CONFIG.free.key).toBe(PLANS.free);
    expect(PLAN_CONFIG.pro.key).toBe(PLANS.pro);
    expect("patron" in PLAN_CONFIG).toBe(false);
  });

  it("defines current Free and Pro allowances in app-owned configuration", () => {
    expect(PLAN_CONFIG.free.allowances).toMatchObject({
      lifetimeGenerateTree: 3,
      growBranchPerCultureTree: 3,
      sharedAiGenerationsPerAllowancePeriod: null,
    });
    expect(PLAN_CONFIG.pro.allowances.lifetimeGenerateTree).toBe(null);
    expect(PLAN_CONFIG.pro.allowances.growBranchPerCultureTree).toBe(null);
    expect(PLAN_CONFIG.pro.allowances.sharedAiGenerationsPerAllowancePeriod).toBeGreaterThan(0);
  });

  it("keeps Generate Tree and Grow Branch as the initial AI Generation usage types", () => {
    expect(AI_GENERATION_USAGE_TYPES).toEqual(["generate_tree", "grow_branch"]);
    expect(PLAN_CONFIG.free.entitlements).toEqual(
      expect.arrayContaining([ENTITLEMENTS.generateTree, ENTITLEMENTS.growBranch]),
    );
    expect(PLAN_CONFIG.pro.entitlements).toEqual(
      expect.arrayContaining([ENTITLEMENTS.generateTree, ENTITLEMENTS.growBranch]),
    );
  });
});

describe("resolveEffectivePlan", () => {
  it("returns Free by default", () => {
    expect(resolveEffectivePlan({ person: null }).key).toBe(PLANS.free);
    expect(resolveEffectivePlan({ person: { email: null } }).key).toBe(PLANS.free);
    expect(resolveEffectivePlan({ person: { email: "someone@example.com" } }).key).toBe(PLANS.free);
  });

  it("returns Pro for normalized email matches in the Pro Allowlist", () => {
    const plan = resolveEffectivePlan({
      person: { email: "  Ross@Example.COM " },
      proAllowlist: ["ross@example.com"],
    });

    expect(plan.key).toBe(PLANS.pro);
  });

  it("parses comma, whitespace, and newline separated Pro Allowlist values", () => {
    expect(parseProAllowlist("alice@example.com, bob@example.com\nCAROL@example.com")).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ]);
  });

  it("grants only the Pro Plan through the Pro Allowlist", () => {
    const plan = resolveEffectivePlan({
      person: { email: "person@example.com" },
      proAllowlist: "person@example.com",
    });

    expect(plan).toEqual(PLAN_CONFIG.pro);
  });
});
