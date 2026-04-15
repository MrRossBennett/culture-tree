import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { YourTreesSection } from "~/components/your-trees-section";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

import { Route as AuthLayoutRoute } from "../route";

export const Route = createFileRoute("/_auth/curator/$username")({
  beforeLoad: ({ context, params }) => {
    const user = context.user;
    if (!user) {
      throw redirect({ to: "/sign-in" });
    }
    if (!user.username) {
      throw redirect({ to: "/onboarding" });
    }
    if (params.username !== user.username) {
      throw redirect({
        to: "/curator/$username",
        params: { username: user.username },
        replace: true,
      });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(myCultureTreesQueryOptions());
  },
  component: CuratorProfilePage,
});

function CuratorProfilePage() {
  const { user } = AuthLayoutRoute.useRouteContext();
  const { username: profileUsername } = Route.useParams();
  const { data } = useQuery(myCultureTreesQueryOptions());

  const trees = data?.trees ?? [];
  const count = data?.count ?? 0;
  const isOwnProfile = user.username === profileUsername;
  const bioText = isOwnProfile ? (user.bio?.trim() ? user.bio.trim() : "—") : "—";

  return (
    <div className="flex flex-1 flex-col py-8">
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6 md:px-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <p className="font-heading text-2xl text-foreground">@{profileUsername}</p>
            <p className="font-body text-sm text-muted-foreground">
              <span className="text-foreground/80">bio:</span>{" "}
              <span className="text-foreground/90">&ldquo;{bioText}&rdquo;</span>
            </p>
          </div>
          {isOwnProfile ? (
            <p className="font-body shrink-0 pt-1 text-sm">
              <Link
                to="/settings/profile"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Edit profile
              </Link>
            </p>
          ) : null}
        </div>

        <hr className="my-8 border-border" />

        <YourTreesSection count={count} trees={trees} />
      </div>
    </div>
  );
}
