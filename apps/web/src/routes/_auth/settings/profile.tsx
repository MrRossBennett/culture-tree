import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: SettingsProfilePage,
});

function SettingsProfilePage() {
  return (
    <div className="space-y-4">
      <p className="font-body text-sm">
        <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
          ← Settings
        </Link>
      </p>
      <h1 className="font-heading text-2xl">Edit profile</h1>
      <p className="font-body text-sm text-muted-foreground">
        Username, bio, and avatar editing will live here in a later phase.
      </p>
    </div>
  );
}
