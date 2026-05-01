import type { AllowanceLimitReached } from "./allowance-gates";

export type LimitReachedAction =
  | "direct_generate_tree"
  | "generate_tree_from_branch"
  | "grow_branch";

export function messageForLimitReached(input: {
  action: LimitReachedAction;
  limitReached: AllowanceLimitReached;
}): string {
  if (input.limitReached.allowance === "pro_shared_ai_generation") {
    return "Your Pro Plan AI Generation Allowance is exhausted for this Allowance Period.";
  }

  if (input.limitReached.allowance === "free_per_tree_grow_branch") {
    return "You've used the 3 Grow Branch actions included for this Culture Tree. Pro access is not self-serve yet, but this is the paid boundary.";
  }

  if (input.action === "generate_tree_from_branch") {
    return "Generating a new Culture Tree from this Branch uses a Generate Tree allowance. You've used the 3 included with the Free Plan. Pro access is not self-serve yet.";
  }

  return "You've used the 3 generated Culture Trees included with the Free Plan. Pro access is not self-serve yet, but this is the paid boundary.";
}

export function withLimitReachedMessage<TLimitReached extends AllowanceLimitReached>(input: {
  action: LimitReachedAction;
  limitReached: TLimitReached;
}): TLimitReached {
  return {
    ...input.limitReached,
    message: messageForLimitReached(input),
  };
}
