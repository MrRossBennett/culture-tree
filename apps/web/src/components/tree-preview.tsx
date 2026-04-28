import type {
  ConnectionTypeValue,
  CultureTree,
  SearchHint,
  TreeEnrichmentsMap,
  TreeItem,
} from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { ClipboardIcon, HeartIcon, LoaderCircleIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import type { TreeResolvedEntitiesMap } from "~/server/entity-resolver";

type TreeRow = {
  capacity: number;
  items: TreeItem[];
  startIndex: number;
};

function splitItemsIntoTreeRows(items: readonly TreeItem[]): TreeRow[] {
  const rows: TreeRow[] = [];
  let index = 0;
  let capacity = 2;

  while (index < items.length) {
    rows.push({
      capacity,
      items: items.slice(index, index + capacity),
      startIndex: index,
    });
    index += capacity;
    capacity = Math.min(capacity + 1, 4);
  }

  return rows;
}

function rowMaxWidth(capacity: number): string {
  switch (capacity) {
    case 1:
      return "22rem";
    case 2:
      return "48rem";
    case 3:
      return "72rem";
    case 4:
      return "96rem";
    default:
      return "100%";
  }
}

function partialFourUpCardStyle(): CSSProperties {
  return {
    flex: "0 1 clamp(16rem, calc((100% - 3 * 1.25rem) / 4), 22rem)",
  };
}

function itemSpanStyle(itemCount: number, capacity: number, index: number): CSSProperties {
  if (capacity >= 4) {
    if (itemCount >= 4) {
      return {
        gridColumn: `${index * 3 + 1} / span 3`,
      };
    }

    if (itemCount === 3) {
      return {
        gridColumn: `${index * 3 + 2} / span 3`,
      };
    }

    if (itemCount === 2) {
      return {
        gridColumn: `${index * 3 + 4} / span 3`,
      };
    }

    return {
      gridColumn: "5 / span 3",
    };
  }

  const baseSpan = Math.floor(capacity / itemCount);
  const remainder = capacity % itemCount;
  const spans = Array.from(
    { length: itemCount },
    (_, itemIndex) => baseSpan + (itemIndex < remainder ? 1 : 0),
  );
  const start = spans.slice(0, index).reduce((sum, span) => sum + span, 1);
  const span = spans[index] ?? 1;

  return {
    gridColumn: `${start} / span ${span}`,
  };
}

function formatConnectionLabel(connectionType: ConnectionTypeValue): string {
  return connectionType.replaceAll("-", " ").toUpperCase();
}

function headingFromSearchHint(
  displayName: string,
  hint: SearchHint,
): { primary: string; secondary?: string } {
  const creator = hint.creator?.trim();
  if (creator) {
    const title = hint.title?.trim() || displayName;
    return { primary: title, secondary: creator };
  }
  return { primary: displayName };
}

function EntityStat({
  icon,
  value,
  tooltip,
}: {
  readonly icon: ReactNode;
  readonly value: number;
  readonly tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground" />
        }
      >
        {icon}
        <span className="font-mono text-[0.62rem] leading-none tabular-nums">{value}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function memberTooltip(count: number): string {
  return `Liked by ${count} member${count === 1 ? "" : "s"}`;
}

function treeTooltip(count: number): string {
  return `Appears in ${count} tree${count === 1 ? "" : "s"}`;
}

export function CultureTreeItemCard({
  item,
  enrichments,
  isLoading = false,
  isGeneratingNewTree = false,
  onDeleteItem,
  onGenerateNewTree,
  onToggleLike,
  resolvedEntity,
  revealIndex = 0,
  style,
}: {
  readonly item: TreeItem;
  readonly enrichments: TreeEnrichmentsMap;
  readonly isLoading?: boolean;
  readonly isGeneratingNewTree?: boolean;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
  readonly onToggleLike?: (entityId: string, liked: boolean) => Promise<void>;
  readonly revealIndex?: number;
  readonly resolvedEntity?: TreeResolvedEntitiesMap[string];
  readonly style?: CSSProperties;
}) {
  const media = enrichments[item.id];
  const itemHeading = headingFromSearchHint(item.name, item.searchHint);
  const coverSrc =
    media?.coverUrl ??
    media?.thumbnailUrl ??
    item.snapshot?.image ??
    resolvedEntity?.imageUrl ??
    undefined;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18, scale: 0.982, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -8, scale: 0.99, filter: "blur(6px)" }}
      whileHover={{ y: -2 }}
      transition={{
        layout: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.5, delay: Math.min(revealIndex, 6) * 0.035 },
        y: { duration: 0.58, delay: Math.min(revealIndex, 6) * 0.035, ease: [0.22, 1, 0.36, 1] },
        scale: {
          duration: 0.58,
          delay: Math.min(revealIndex, 6) * 0.035,
          ease: [0.22, 1, 0.36, 1],
        },
        filter: { duration: 0.44, delay: Math.min(revealIndex, 6) * 0.035, ease: "easeOut" },
      }}
      className="group relative overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/92 shadow-[0_24px_70px_-46px_rgba(30,22,10,0.55)] will-change-transform"
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.1),transparent_52%)]" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="relative flex items-start justify-between gap-3 border-b border-border/45 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground uppercase">
          <NodeTypeBadge type={item.type} showIcon className="text-[0.54rem]" />
          {isLoading ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[0.56rem] tracking-wide">
              <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
              Adding
            </span>
          ) : (
            <span
              className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[0.56rem] tracking-wide"
              title="Relationship to seed"
            >
              {formatConnectionLabel(item.connectionType)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {resolvedEntity && !isLoading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={
                resolvedEntity.likedByCurrentUser
                  ? "shrink-0 text-rose-600 hover:text-rose-700"
                  : "shrink-0 text-muted-foreground hover:text-rose-600"
              }
              onClick={() =>
                void onToggleLike?.(resolvedEntity.id, resolvedEntity.likedByCurrentUser)
              }
              aria-label={
                resolvedEntity.likedByCurrentUser
                  ? `Unlike ${resolvedEntity.name}`
                  : `Like ${resolvedEntity.name}`
              }
            >
              <HeartIcon
                className={cn("size-3.5", resolvedEntity.likedByCurrentUser ? "fill-current" : "")}
                aria-hidden
              />
            </Button>
          ) : null}
          {onGenerateNewTree && !isLoading ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-amber"
                    disabled={isGeneratingNewTree}
                    onClick={() => void onGenerateNewTree(item)}
                    aria-label={`Generate new tree from ${item.name}`}
                  />
                }
              >
                <SparklesIcon className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Generate new tree →</TooltipContent>
            </Tooltip>
          ) : null}
          {onDeleteItem && !isLoading ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteItem(item)}
                    aria-label={`Delete ${item.name} from this tree`}
                  />
                }
              >
                <Trash2Icon className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Delete branch</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className="relative flex gap-0">
        <div className="shrink-0 border-r border-border/55 bg-muted/10">
          <NodeThumbnail type={item.type} src={coverSrc} size="md" />
          {resolvedEntity ? (
            <div className="flex items-center justify-center gap-1 border-t border-border/45 bg-background/55 px-1 py-1">
              <EntityStat
                icon={<HeartIcon className="size-3.5 text-rose-600" aria-hidden />}
                value={resolvedEntity.likeCount}
                tooltip={memberTooltip(resolvedEntity.likeCount)}
              />
              <EntityStat
                icon={<ClipboardIcon className="size-3.5 text-primary/80" aria-hidden />}
                value={resolvedEntity.appearanceCount}
                tooltip={treeTooltip(resolvedEntity.appearanceCount)}
              />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 px-4 py-2">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-heading text-xl leading-snug tracking-tight text-card-foreground md:text-2xl">
              {itemHeading.primary}
            </h3>
            {item.year != null ? (
              <span className="font-mono text-[0.64rem] text-muted-foreground tabular-nums">
                {item.year}
              </span>
            ) : null}
          </div>
          {itemHeading.secondary ? (
            <p className="mb-2 font-mono text-[0.68rem] tracking-wide text-primary/80">
              {itemHeading.secondary}
            </p>
          ) : null}
          {item.type === "song" && media?.musicAlbumTitle ? (
            <p className="font-body mt-1.5 text-xs leading-snug text-muted-foreground normal-case">
              From the album{" "}
              {media.musicAlbumExternalUrl ? (
                <a
                  className="text-primary hover:underline"
                  href={media.musicAlbumExternalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {media.musicAlbumTitle}
                </a>
              ) : (
                <span className="text-foreground/85">{media.musicAlbumTitle}</span>
              )}
            </p>
          ) : null}
          {item.reason ? (
            <p className="font-body mt-2 line-clamp-4 text-sm leading-relaxed text-foreground/80 italic">
              {item.reason}
            </p>
          ) : isLoading ? (
            <div className="mt-3 space-y-2" aria-label="Finding the connection">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin text-primary" aria-hidden />
                Finding the connection…
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              <div className="h-2 w-4/5 animate-pulse rounded-full bg-muted" />
              <div className="h-2 w-2/3 animate-pulse rounded-full bg-muted" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

export function TreePreview({
  tree,
  enrichments = {},
  loadingItemIds = [],
  isGeneratingNewTree = false,
  onDeleteItem,
  onGenerateNewTree,
  onToggleLike,
  resolvedEntities = {},
}: {
  readonly tree: CultureTree;
  readonly enrichments?: TreeEnrichmentsMap;
  readonly loadingItemIds?: readonly string[];
  readonly isGeneratingNewTree?: boolean;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
  readonly onToggleLike?: (entityId: string, liked: boolean) => Promise<void>;
  readonly resolvedEntities?: TreeResolvedEntitiesMap;
}) {
  const itemRows = splitItemsIntoTreeRows(tree.items);
  const loadingItemIdSet = new Set(loadingItemIds);

  return (
    <section className="relative w-full text-left">
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.12),transparent_46%)]" />
      {itemRows.length > 0 ? (
        <div className="relative">
          <motion.div layout className="space-y-4 md:space-y-5">
            {itemRows.map((row, rowIndex) =>
              row.capacity >= 4 && row.items.length < 4 ? (
                <motion.div
                  layout
                  key={`tree-row-${rowIndex}`}
                  className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 md:gap-5"
                  style={{ maxWidth: rowMaxWidth(row.capacity) }}
                >
                  <AnimatePresence>
                    {row.items.map((item, itemIndex) => (
                      <CultureTreeItemCard
                        key={item.id}
                        enrichments={enrichments}
                        isLoading={loadingItemIdSet.has(item.id)}
                        isGeneratingNewTree={isGeneratingNewTree}
                        item={item}
                        onDeleteItem={onDeleteItem}
                        onGenerateNewTree={onGenerateNewTree}
                        onToggleLike={onToggleLike}
                        revealIndex={row.startIndex + itemIndex}
                        resolvedEntity={resolvedEntities[item.id]}
                        style={partialFourUpCardStyle()}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  layout
                  key={`tree-row-${rowIndex}`}
                  className="mx-auto grid grid-cols-1 gap-4 md:gap-5"
                  style={{
                    gridTemplateColumns:
                      row.capacity >= 4
                        ? "repeat(12, minmax(0, 1fr))"
                        : row.capacity > 1
                          ? `repeat(${row.capacity}, minmax(0, 1fr))`
                          : undefined,
                    maxWidth: rowMaxWidth(row.capacity),
                  }}
                >
                  <AnimatePresence>
                    {row.items.map((item, itemIndex) => (
                      <CultureTreeItemCard
                        key={item.id}
                        enrichments={enrichments}
                        isLoading={loadingItemIdSet.has(item.id)}
                        isGeneratingNewTree={isGeneratingNewTree}
                        item={item}
                        onDeleteItem={onDeleteItem}
                        onGenerateNewTree={onGenerateNewTree}
                        onToggleLike={onToggleLike}
                        revealIndex={row.startIndex + itemIndex}
                        resolvedEntity={resolvedEntities[item.id]}
                        style={itemSpanStyle(row.items.length, row.capacity, itemIndex)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ),
            )}
          </motion.div>
        </div>
      ) : (
        <p className="font-body mt-4 text-center text-sm text-muted-foreground">No items yet.</p>
      )}
    </section>
  );
}
