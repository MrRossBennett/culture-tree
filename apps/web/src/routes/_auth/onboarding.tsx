import { $getUserFresh } from "@repo/auth/tanstack/functions";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { $checkUsernameAvailable, $completeOnboarding } from "~/server/onboarding";

import { Route as AuthLayoutRoute } from "./route";

export const Route = createFileRoute("/_auth/onboarding")({
  beforeLoad: ({ context }) => {
    const user = context.user;
    if (user.username) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = AuthLayoutRoute.useRouteContext();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [checkResult, setCheckResult] = useState<Awaited<
    ReturnType<typeof $checkUsernameAvailable>
  > | null>(null);
  const [checkPending, setCheckPending] = useState(false);

  useEffect(() => {
    const raw = username.trim();
    if (raw.length < 3) {
      setCheckResult(null);
      return;
    }
    setCheckPending(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const r = await $checkUsernameAvailable({ data: { candidate: raw } });
          setCheckResult(r);
        } finally {
          setCheckPending(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [username]);

  const complete = useMutation({
    mutationFn: async () => {
      const result = await $completeOnboarding({
        data: { username: username.trim(), bio: bio.trim() || undefined },
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      await queryClient.fetchQuery({
        ...authQueryOptions(),
        queryFn: () => $getUserFresh(),
      });
    },
    onSuccess: () => {
      toast.success("You're all set.");
      void navigate({ to: "/" });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not save profile.");
    },
  });

  const canSubmit =
    checkResult?.available === true &&
    !checkPending &&
    username.trim().length >= 3 &&
    !complete.isPending;

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl text-foreground">Pick a username</h1>
          <p className="font-body text-sm text-muted-foreground">
            This becomes your public profile URL. Signed in as{" "}
            <span className="font-mono text-xs">{user.email}</span>.
          </p>
        </div>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            complete.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="onboarding-username">Username</Label>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">/curator/</span>
                <Input
                  id="onboarding-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="max-w-[min(100%,280px)] font-mono text-sm"
                  placeholder="elenapostpunk"
                />
              </div>
              {checkPending ? (
                <p className="font-body text-xs text-muted-foreground">Checking…</p>
              ) : checkResult?.error ? (
                <p className="font-body text-xs text-destructive">{checkResult.error}</p>
              ) : checkResult?.available ? (
                <p className="font-body text-xs text-muted-foreground">Available.</p>
              ) : username.trim().length >= 3 ? (
                <p className="font-body text-xs text-destructive">Not available.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-bio">Bio (optional)</Label>
            <textarea
              id="onboarding-bio"
              name="bio"
              rows={2}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="font-body flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="One line about what you’re into"
            />
            <p className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
              {bio.length}/160
            </p>
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full gap-2 sm:w-auto">
            {complete.isPending ? (
              <>
                <LoaderCircleIcon className="size-4 shrink-0 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
