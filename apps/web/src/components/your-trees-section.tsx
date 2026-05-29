import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { useQuery } from "@tanstack/react-query";

import { TreeSummaryCard, type TreeSummaryCardData } from "~/components/tree-summary-card";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

export type YourTreesListItem = TreeSummaryCardData;

export function YourTreesSection({
  count,
  isLoading = false,
  trees,
  emptyMessage = "Create a Culture Tree to start shaping your library.",
  title = "Your trees",
}: {
  readonly count: number;
  readonly isLoading?: boolean;
  readonly trees: readonly YourTreesListItem[];
  readonly emptyMessage?: string;
  readonly title?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
          {title}
        </p>
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground tabular-nums">
          {count} {count === 1 ? "tree" : "trees"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="min-h-64 rounded-[1.4rem] border border-border/70 bg-card/70 p-4"
            >
              <div className="mb-4 flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-28 animate-pulse rounded-md bg-muted/55" />
              <div className="mt-4 h-6 w-2/3 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : trees.length === 0 ? (
        <p className="font-body text-sm font-normal tracking-tight text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {trees.map((t) => (
            <TreeSummaryCard key={t.id} tree={t} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeYourTrees() {
  const { data: user } = useQuery(authQueryOptions());
  const { data, isLoading } = useQuery({
    ...myCultureTreesQueryOptions(),
    enabled: Boolean(user),
  });

  if (!user) {
    return null;
  }

  return (
    <section className="relative z-10 w-full">
      <YourTreesSection count={data?.count ?? 0} isLoading={isLoading} trees={data?.trees ?? []} />
    </section>
  );
}
