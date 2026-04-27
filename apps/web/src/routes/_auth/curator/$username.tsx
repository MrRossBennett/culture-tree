import type { NodeTypeValue } from "@repo/schemas";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HeartIcon } from "lucide-react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { YourTreesSection } from "~/components/your-trees-section";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { $listMyLikedEntities } from "~/server/entity-resolver";

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
    const liked = await $listMyLikedEntities();
    return { likedEntities: liked.entities };
  },
  component: CuratorProfilePage,
});

function CuratorProfilePage() {
  const { user } = AuthLayoutRoute.useRouteContext();
  const { username: profileUsername } = Route.useParams();
  const { likedEntities } = Route.useLoaderData();
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

        <section className="mt-10 space-y-4">
          <div className="flex items-center gap-2">
            <HeartIcon className="size-4 text-rose-600" aria-hidden />
            <h2 className="font-heading text-xl tracking-tight text-foreground">Liked things</h2>
          </div>
          {likedEntities.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {likedEntities.map((item) => (
                <article
                  key={item.id}
                  className="flex min-w-0 items-center gap-3 rounded border border-border/70 bg-card/80 p-3"
                >
                  <NodeThumbnail
                    type={item.type as NodeTypeValue}
                    src={item.imageUrl ?? undefined}
                    size="sm"
                    className="size-11 rounded-none object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="font-heading min-w-0 truncate text-base text-card-foreground">
                        {item.name}
                      </p>
                      {item.year ? (
                        <span className="font-mono text-[0.6rem] text-muted-foreground tabular-nums">
                          {item.year}
                        </span>
                      ) : null}
                    </div>
                    {item.creatorName ? (
                      <p className="mt-0.5 truncate font-mono text-[0.62rem] tracking-wide text-primary/80">
                        {item.creatorName}
                      </p>
                    ) : null}
                    <div className="mt-1 flex items-center gap-2">
                      <NodeTypeBadge type={item.type as NodeTypeValue} className="text-[0.52rem]" />
                      <span className="font-mono text-[0.58rem] tracking-wide text-muted-foreground uppercase">
                        {item.likeCount} like{item.likeCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="font-body rounded border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No liked things yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
