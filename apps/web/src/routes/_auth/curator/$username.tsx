import type { NodeTypeValue } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HeartIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { YourTreesSection } from "~/components/your-trees-section";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { $addLikedEntityToTree, $listMyLikedEntities } from "~/server/entity-resolver";

import { Route as AuthLayoutRoute } from "../route";

type LikedEntity = Awaited<ReturnType<typeof $listMyLikedEntities>>["entities"][number];
type AddToTreeTarget = {
  id: string;
  title: string;
};

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
  const queryClient = useQueryClient();
  const { data } = useQuery(myCultureTreesQueryOptions());
  const addLikedEntity = useMutation({
    mutationFn: (input: { entityId: string; targetTreeId: string }) =>
      $addLikedEntityToTree({ data: input }),
    onSuccess: async () => {
      toast.success("Branch added to your tree.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add that Branch.");
    },
  });

  const trees = data?.trees ?? [];
  const count = data?.count ?? 0;
  const addToTreeTargets: AddToTreeTarget[] = trees
    .filter((tree) => tree.generationStatus === "ready")
    .map((tree) => ({ id: tree.id, title: tree.listTitle }));
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
            <h2 className="font-heading text-xl tracking-tight text-foreground">Liked Branches</h2>
          </div>
          {likedEntities.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {likedEntities.map((item) => (
                <LikedBranchCard
                  key={item.id}
                  item={item}
                  targets={addToTreeTargets}
                  isPending={addLikedEntity.isPending}
                  onAddToTree={(targetTreeId) =>
                    addLikedEntity.mutateAsync({ entityId: item.id, targetTreeId })
                  }
                />
              ))}
            </div>
          ) : (
            <p className="font-body rounded border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No liked Branches yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function LikedBranchCard({
  item,
  targets,
  isPending,
  onAddToTree,
}: {
  readonly item: LikedEntity;
  readonly targets: readonly AddToTreeTarget[];
  readonly isPending: boolean;
  readonly onAddToTree: (targetTreeId: string) => Promise<unknown>;
}) {
  const [targetTreeId, setTargetTreeId] = useState("");
  const resolvedTargetTreeId = targetTreeId || targets[0]?.id || "";

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded border border-border/70 bg-card/80 p-3">
      <div className="flex min-w-0 items-center gap-3">
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
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          value={resolvedTargetTreeId}
          onValueChange={(value) => setTargetTreeId(value ?? "")}
        >
          <SelectTrigger size="sm" className="max-w-44 rounded-full">
            <SelectValue placeholder="Choose tree" />
          </SelectTrigger>
          <SelectContent>
            {targets.map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {target.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !resolvedTargetTreeId}
          className="rounded-full"
          onClick={() => {
            if (!resolvedTargetTreeId) {
              return;
            }
            void onAddToTree(resolvedTargetTreeId);
          }}
        >
          {isPending ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <PlusIcon className="size-3.5" aria-hidden />
          )}
          Add to Tree
        </Button>
      </div>
    </article>
  );
}
