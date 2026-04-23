import type {
  ConnectionTypeValue,
  CultureTree,
  SearchHint,
  TreeEnrichmentsMap,
  TreeItem,
} from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { SparklesIcon, SproutIcon, StarIcon, Trash2Icon } from "lucide-react";
import type { CSSProperties } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { TreeNodePopover, type TreeNodePopoverSubmitInput } from "~/components/tree-node-popover";

type TreeRow = {
  capacity: number;
  items: TreeItem[];
};

function splitItemsIntoTreeRows(items: readonly TreeItem[]): TreeRow[] {
  const rows: TreeRow[] = [];
  let index = 0;
  let capacity = 2;

  while (index < items.length) {
    rows.push({
      capacity,
      items: items.slice(index, index + capacity),
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

export function CultureTreeSeedCard({
  tree,
  ownerUsername,
  isAddItemPending = false,
  onAddItem,
}: {
  readonly tree: CultureTree;
  readonly ownerUsername?: string | null;
  readonly isAddItemPending?: boolean;
  readonly onAddItem?: (parentItemId: string, node: TreeNodePopoverSubmitInput) => Promise<void>;
}) {
  const byline = ownerUsername?.trim() ? `by ${ownerUsername.trim()}` : null;

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <div className="pointer-events-none absolute top-1 left-1/2 h-8 w-px -translate-x-1/2 bg-linear-to-b from-primary/10 via-primary/35 to-transparent" />
      <div className="relative w-full rounded-[1.2rem] border border-primary/20 bg-card/90 bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.12),transparent_58%)] px-4 py-4 shadow-[0_16px_48px_-40px_rgba(120,78,18,0.35)] md:px-5 md:py-4.5">
        <div className="mx-auto flex max-w-md flex-col items-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/16 bg-background/70 px-2.5 py-1 font-mono text-[0.56rem] tracking-[0.16em] text-primary uppercase backdrop-blur-sm">
            <SproutIcon className="size-3" aria-hidden />
            <span>Seed</span>
          </div>
          <h2 className="font-heading text-2xl leading-[1.06] tracking-tight text-card-foreground md:text-3xl">
            {tree.seed}
          </h2>
          {byline ? (
            <p className="font-body mt-2 text-base text-muted-foreground italic md:text-lg">
              {byline}
            </p>
          ) : null}
          {onAddItem ? (
            <div className="mt-3">
              <TreeNodePopover
                triggerLabel="Grow new branch"
                triggerClassName="text-[0.58rem]"
                isPending={isAddItemPending}
                onSubmit={(node) => onAddItem("root", node)}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 h-8 w-px bg-gradient-to-b from-primary/40 via-primary/18 to-transparent" />
    </div>
  );
}

export function CultureTreeItemCard({
  item,
  enrichments,
  isGeneratingNewTree = false,
  onDeleteItem,
  onGenerateNewTree,
  style,
}: {
  readonly item: TreeItem;
  readonly enrichments: TreeEnrichmentsMap;
  readonly isGeneratingNewTree?: boolean;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
  readonly style?: CSSProperties;
}) {
  const media = enrichments[item.id];
  const itemHeading = headingFromSearchHint(item.name, item.searchHint);
  const coverSrc = media?.coverUrl ?? media?.thumbnailUrl ?? item.snapshot?.image;

  return (
    <article
      className="group relative overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/92 shadow-[0_24px_70px_-46px_rgba(30,22,10,0.55)] transition-transform duration-200 hover:-translate-y-0.5"
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.1),transparent_52%)]" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="relative flex items-start justify-between gap-3 border-b border-border/45 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground uppercase">
          <NodeTypeBadge type={item.type} showIcon className="text-[0.54rem]" />
          <span
            className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[0.56rem] tracking-wide"
            title="Relationship to seed"
          >
            {formatConnectionLabel(item.connectionType)}
          </span>
          {media?.rating != null ? (
            <span className="inline-flex items-center gap-0.5 tracking-normal text-foreground/80 normal-case tabular-nums">
              <StarIcon className="size-3.5 text-amber-500/90" aria-hidden />
              {media.rating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onGenerateNewTree ? (
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
          {onDeleteItem ? (
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
        <NodeThumbnail
          type={item.type}
          src={coverSrc}
          size="md"
          className="border-r border-border/55 bg-muted/10"
        />
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
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function TreePreview({
  tree,
  ownerUsername,
  enrichments = {},
  isAddItemPending = false,
  isGeneratingNewTree = false,
  onAddItem,
  onDeleteItem,
  onGenerateNewTree,
}: {
  readonly tree: CultureTree;
  readonly ownerUsername?: string | null;
  readonly enrichments?: TreeEnrichmentsMap;
  readonly isAddItemPending?: boolean;
  readonly isGeneratingNewTree?: boolean;
  readonly onAddItem?: (parentItemId: string, node: TreeNodePopoverSubmitInput) => Promise<void>;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
}) {
  const itemRows = splitItemsIntoTreeRows(tree.items);

  return (
    <section className="relative w-full text-left">
      <div className="pointer-events-none absolute inset-x-0 top-6 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(214,154,78,0.14),transparent_40%)]" />
      <CultureTreeSeedCard
        tree={tree}
        ownerUsername={ownerUsername}
        isAddItemPending={isAddItemPending}
        onAddItem={onAddItem}
      />
      {itemRows.length > 0 ? (
        <div className="relative mt-2">
          <div className="mx-auto mb-6 hidden h-px max-w-5xl bg-linear-to-r from-transparent via-primary/25 to-transparent md:block" />
          <div className="space-y-4 md:space-y-5">
            {itemRows.map((row, rowIndex) =>
              row.capacity >= 4 && row.items.length < 4 ? (
                <div
                  key={`tree-row-${rowIndex}`}
                  className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 md:gap-5"
                  style={{ maxWidth: rowMaxWidth(row.capacity) }}
                >
                  {row.items.map((item) => (
                    <CultureTreeItemCard
                      key={item.id}
                      enrichments={enrichments}
                      isGeneratingNewTree={isGeneratingNewTree}
                      item={item}
                      onDeleteItem={onDeleteItem}
                      onGenerateNewTree={onGenerateNewTree}
                      style={partialFourUpCardStyle()}
                    />
                  ))}
                </div>
              ) : (
                <div
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
                  {row.items.map((item, itemIndex) => (
                    <CultureTreeItemCard
                      key={item.id}
                      enrichments={enrichments}
                      isGeneratingNewTree={isGeneratingNewTree}
                      item={item}
                      onDeleteItem={onDeleteItem}
                      onGenerateNewTree={onGenerateNewTree}
                      style={itemSpanStyle(row.items.length, row.capacity, itemIndex)}
                    />
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        <p className="font-body mt-4 text-center text-sm text-muted-foreground">No items yet.</p>
      )}
    </section>
  );
}
