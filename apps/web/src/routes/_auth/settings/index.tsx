import { useAuthSuspense } from "@repo/auth/tanstack/hooks";
import { createFileRoute } from "@tanstack/react-router";

import { $getAllowanceSummary } from "~/server/get-allowance-summary";

export const Route = createFileRoute("/_auth/settings/")({
  loader: () => $getAllowanceSummary(),
  component: SettingsIndex,
});

function SettingsIndex() {
  const { user } = useAuthSuspense();
  const summary = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl">Settings</h1>
        <p className="font-mono text-xs text-muted-foreground">
          Signed in as {user?.email ?? user?.name}
          {user?.username ? (
            <>
              <br />@{user.username}
            </>
          ) : null}
        </p>
      </div>

      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h2 className="font-heading text-xl">Allowance Summary</h2>
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {summary.effectivePlan.label}
          </p>
        </div>

        {summary.usage.kind === "free" ? (
          <div className="font-body space-y-2 text-sm text-muted-foreground">
            <p>
              Generated trees used: {summary.usage.generatedTreesUsed} /{" "}
              {summary.usage.generatedTreeLimit ?? "unlimited"}
            </p>
            <p>
              Grow Branch allowance: {summary.usage.growBranchPerCultureTree ?? "unlimited"} per
              Culture Tree
            </p>
            <p>Deleting Culture Trees or Branches does not restore usage.</p>
          </div>
        ) : (
          <div className="font-body space-y-2 text-sm text-muted-foreground">
            <p>
              AI Generations used: {summary.usage.paidAiGenerationsUsed} /{" "}
              {summary.usage.paidAiGenerationLimit ?? "unlimited"}
            </p>
            <p>
              Allowance Period: {new Date(summary.usage.allowancePeriodStart).toLocaleDateString()}{" "}
              - {new Date(summary.usage.allowancePeriodEnd).toLocaleDateString()}
            </p>
          </div>
        )}
      </section>

      <div className="space-y-2 border-t border-border pt-5">
        <h2 className="font-heading text-xl">Account</h2>
        <p className="font-body text-sm text-muted-foreground">
          Subscription and delete account controls are coming in a later phase.
        </p>
      </div>
    </div>
  );
}
