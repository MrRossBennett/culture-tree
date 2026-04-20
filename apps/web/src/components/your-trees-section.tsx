import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

export type YourTreesListItem = {
  readonly id: string;
  readonly listTitle: string;
  readonly nodeCount: number;
  readonly createdAt: string;
  readonly isPublic: boolean;
};

function formatTreeAge(iso: string): string {
  const s = formatDistanceToNow(new Date(iso), { addSuffix: true });
  return s.replace(/^about /i, "");
}

/** Inner block: matches `HomeSuggestions` label scale + `space-y-4`; rows echo suggestion chip border/type scale. */
export function YourTreesSection({
  count,
  trees,
  emptyMessage = "No trees yet — plant one from the home page.",
}: {
  readonly count: number;
  readonly trees: readonly YourTreesListItem[];
  readonly emptyMessage?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
          Your trees
        </p>
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground tabular-nums">
          {count} {count === 1 ? "tree" : "trees"}
        </p>
      </div>

      {trees.length === 0 ? (
        <p className="font-body text-sm font-normal tracking-tight text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {trees.map((t) => (
            <Link
              key={t.id}
              to="/tree/$treeId"
              params={{ treeId: t.id }}
              className="font-body flex flex-col gap-1 rounded-lg border border-border/80 px-3.5 py-3 text-sm font-normal tracking-tight text-muted-foreground transition-colors hover:bg-muted/40 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="min-w-0 text-foreground capitalize italic">{t.listTitle}</span>
              <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground not-italic tabular-nums">
                {t.nodeCount} {t.nodeCount === 1 ? "branch" : "branches"} ·{" "}
                {formatTreeAge(t.createdAt)} · {t.isPublic ? "Public" : "Private"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** Home: same shell as `HomeSuggestions` (`relative z-10 mx-auto max-w-3xl px-4 sm:px-6 md:px-0`). */
export function HomeYourTrees() {
  const { data: user } = useQuery(authQueryOptions());
  const { data } = useQuery({
    ...myCultureTreesQueryOptions(),
    enabled: Boolean(user),
  });

  if (!user) {
    return null;
  }

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6 md:px-0">
      <YourTreesSection count={data?.count ?? 0} trees={data?.trees ?? []} />
    </section>
  );
}
