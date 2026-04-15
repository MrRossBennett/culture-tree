import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { user as userTable } from "@repo/db/schema";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Top-level or future routes — block as usernames so `/curator/$username` never clashes with app URLs. */
const RESERVED = new Set([
  "about",
  "admin",
  "api",
  "app",
  "blog",
  "contact",
  "culture-tree",
  "curator",
  "discover",
  "docs",
  "explore",
  "feed",
  "help",
  "login",
  "notifications",
  "onboarding",
  "pricing",
  "privacy",
  "search",
  "settings",
  "sign-in",
  "sign-up",
  "signin",
  "signup",
  "status",
  "support",
  "terms",
  "tree",
  "user",
  "www",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** `null` if valid; otherwise a short error message. */
export function validateUsernameFormat(candidate: string): string | null {
  const n = normalizeUsername(candidate);
  if (n.length < 3 || n.length > 30) {
    return "Username must be 3–30 characters.";
  }
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(n)) {
    return "Use lowercase letters, numbers, underscores, or hyphens. Start and end with a letter or number.";
  }
  if (RESERVED.has(n)) {
    return "This username is reserved.";
  }
  return null;
}

export const $checkUsernameAvailable = createServerFn({ method: "GET" })
  .inputValidator(z.object({ candidate: z.string() }))
  .handler(async ({ data }) => {
    const formatError = validateUsernameFormat(data.candidate);
    if (formatError) {
      return { available: false as const, normalized: null as string | null, error: formatError };
    }
    const normalized = normalizeUsername(data.candidate);
    const [row] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, normalized))
      .limit(1);
    if (row) {
      return {
        available: false as const,
        normalized,
        error: "That username is taken." as const,
      };
    }
    return { available: true as const, normalized, error: null };
  });

const completeOnboardingInput = z.object({
  username: z.string().min(1),
  bio: z.string().max(160).optional(),
});

export const $completeOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(completeOnboardingInput)
  .handler(async ({ data, context }) => {
    const sessionUser = context.user;
    if (sessionUser.username) {
      return { ok: true as const, alreadyComplete: true as const };
    }

    const formatError = validateUsernameFormat(data.username);
    if (formatError) {
      return { ok: false as const, error: formatError };
    }
    const normalized = normalizeUsername(data.username);

    const [taken] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, normalized))
      .limit(1);
    if (taken) {
      return { ok: false as const, error: "That username is taken." as const };
    }

    const bioTrim = data.bio?.trim();
    const bio = bioTrim && bioTrim.length > 0 ? bioTrim : null;

    await db
      .update(userTable)
      .set({ username: normalized, bio })
      .where(eq(userTable.id, sessionUser.id));

    return { ok: true as const, alreadyComplete: false as const };
  });
