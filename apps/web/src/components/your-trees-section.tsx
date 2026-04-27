import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { NodeTypeValue } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { motion } from "motion/react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

export type YourTreesListItem = {
  readonly id: string;
  readonly listTitle: string;
  readonly nodeCount: number;
  readonly createdAt: string;
  readonly isPublic: boolean;
  readonly generationStatus: string;
  readonly previewItems: readonly {
    readonly type: NodeTypeValue;
    readonly imageUrl?: string;
  }[];
};

function formatTreeAge(iso: string): string {
  const s = formatDistanceToNow(new Date(iso), { addSuffix: true });
  return s.replace(/^about /i, "");
}

function formatTreeStatus(t: YourTreesListItem): string {
  if (t.generationStatus === "ready") {
    const branchCount = Math.max(0, t.nodeCount - 1);
    return `${branchCount} ${branchCount === 1 ? "branch" : "branches"}`;
  }

  if (t.generationStatus === "failed") {
    return "Stopped draft";
  }

  return "Growing";
}

function TreeThumbnailStack({
  items,
  isGrowing,
}: {
  readonly items: YourTreesListItem["previewItems"];
  readonly isGrowing: boolean;
}) {
  const visibleItems = items.slice(0, 6);
  const placeholders = Math.max(0, 6 - visibleItems.length);

  return (
    <div className="flex h-28 w-full items-center overflow-hidden bg-muted/10 px-4 py-3">
      <div className="flex h-full w-full min-w-0 items-stretch overflow-hidden rounded-md border border-border/70 bg-background/80 p-1.5 shadow-[0_14px_36px_-28px_rgba(22,18,12,0.7)]">
        {visibleItems.map((item, index) => (
          <motion.div
            key={`${item.type}-${item.imageUrl ?? "fallback"}-${index}`}
            initial={{ opacity: 0, x: -8, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.42,
              delay: Math.min(index, 5) * 0.035,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={cn(
              "relative min-w-0 flex-1 basis-0 overflow-hidden rounded-sm border border-background bg-muted shadow-sm",
              index > 0 && "-ml-3",
            )}
            style={{ zIndex: visibleItems.length - index }}
          >
            <NodeThumbnail
              type={item.type}
              src={item.imageUrl}
              size="sm"
              className="h-full w-full rounded-none object-cover object-center"
            />
          </motion.div>
        ))}
        {Array.from({ length: placeholders }).map((_, index) => (
          <div
            key={`placeholder-${index}`}
            className={cn(
              "min-w-0 flex-1 basis-0 rounded-sm border border-background bg-muted/35",
              index > 0 || visibleItems.length > 0 ? "-ml-3" : "",
              isGrowing && "animate-pulse",
            )}
          />
        ))}
      </div>
    </div>
  );
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
        <div className="grid gap-3 sm:grid-cols-2">
          {trees.map((t) => (
            <Link
              key={t.id}
              to="/tree/$treeId"
              params={{ treeId: t.id }}
              className="font-body group relative overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/92 text-sm font-normal tracking-tight text-muted-foreground shadow-[0_24px_70px_-46px_rgba(30,22,10,0.55)] transition-colors hover:border-primary/25"
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.1),transparent_52%)]" />
              <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <span className="relative flex items-start justify-between gap-3 border-b border-border/45 px-4 py-3">
                <span className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground uppercase">
                  <span className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[0.56rem] tracking-wide">
                    {formatTreeAge(t.createdAt)}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[0.56rem] tracking-wide">
                    {formatTreeStatus(t)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-border/60 bg-background/70 px-2 py-1 font-mono text-[0.56rem] tracking-wide text-muted-foreground uppercase">
                  {t.isPublic ? "Public" : "Private"}
                </span>
              </span>
              <span className="relative block border-b border-border/55">
                <TreeThumbnailStack
                  items={t.previewItems}
                  isGrowing={t.generationStatus !== "ready" && t.generationStatus !== "failed"}
                />
              </span>
              <span className="relative flex min-w-0 flex-col gap-2 px-4 py-3">
                <span className="font-heading min-w-0 text-xl leading-snug tracking-tight text-card-foreground capitalize transition-colors group-hover:text-primary md:text-2xl">
                  {t.listTitle}
                </span>
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
