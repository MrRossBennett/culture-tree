import { ENTITLEMENTS } from "@repo/entitlements";
import { describe, expect, it } from "vite-plus/test";

import { messageForLimitReached } from "./limit-reached-messages";

describe("Limit Reached messages", () => {
  it("explains blocked direct Generate Tree actions", () => {
    expect(
      messageForLimitReached({
        action: "direct_generate_tree",
        limitReached: {
          code: "limit_reached",
          allowance: "free_lifetime_generate_tree",
          usageType: ENTITLEMENTS.generateTree,
          limit: 3,
          used: 3,
          remaining: 0,
          message: "",
        },
      }),
    ).toBe(
      "You've used the 3 generated Culture Trees included with the Free Plan. Pro access is not self-serve yet, but this is the paid boundary.",
    );
  });

  it("explains blocked Generate Tree from a Branch actions", () => {
    expect(
      messageForLimitReached({
        action: "generate_tree_from_branch",
        limitReached: {
          code: "limit_reached",
          allowance: "free_lifetime_generate_tree",
          usageType: ENTITLEMENTS.generateTree,
          limit: 3,
          used: 3,
          remaining: 0,
          message: "",
        },
      }),
    ).toBe(
      "Generating a new Culture Tree from this Branch uses a Generate Tree allowance. You've used the 3 included with the Free Plan. Pro access is not self-serve yet.",
    );
  });

  it("explains blocked Grow Branch actions", () => {
    expect(
      messageForLimitReached({
        action: "grow_branch",
        limitReached: {
          code: "limit_reached",
          allowance: "free_per_tree_grow_branch",
          usageType: ENTITLEMENTS.growBranch,
          limit: 3,
          used: 3,
          remaining: 0,
          message: "",
        },
      }),
    ).toBe(
      "You've used the 3 Grow Branch actions included for this Culture Tree. Pro access is not self-serve yet, but this is the paid boundary.",
    );
  });

  it("explains exhausted Pro paid AI Generation Allowance", () => {
    expect(
      messageForLimitReached({
        action: "grow_branch",
        limitReached: {
          code: "limit_reached",
          allowance: "pro_shared_ai_generation",
          usageType: ENTITLEMENTS.growBranch,
          limit: 100,
          used: 100,
          remaining: 0,
          message: "",
        },
      }),
    ).toBe("Your Pro Plan AI Generation Allowance is exhausted for this Allowance Period.");
  });
});
