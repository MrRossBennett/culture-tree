import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <Outlet />
      </div>
    </div>
  );
}
