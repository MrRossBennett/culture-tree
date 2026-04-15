import { useAuthSuspense } from "@repo/auth/tanstack/hooks";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { user } = useAuthSuspense();

  return (
    <div className="space-y-2">
      <h1 className="font-heading text-2xl">Settings</h1>
      <p className="font-body text-sm text-muted-foreground">
        Account, subscription, and delete account — coming in a later phase.
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Signed in as {user?.email ?? user?.name}
        {user?.username ? (
          <>
            <br />@{user.username}
          </>
        ) : null}
      </p>
    </div>
  );
}
