import {
  filterCultureTreeToNodeTypes,
  formatGuideSectionTitle,
  type ConnectionTypeValue,
  type CultureTree,
  type GuideSection,
  type GuideSectionIdValue,
  type NodeTypeValue,
  type SearchHint,
  type TreeEnrichmentsMap,
  type TreeItem,
} from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  ImageIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AddToTreePopover, type AddToTreeTarget } from "~/components/add-to-tree-popover";
import { Masonry } from "~/components/masonry";
import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { NodeTypeFilterList } from "~/components/node-type-filter-list";
import { TreeNodeDialog } from "~/components/tree-node-popover";
import type { TreeNodePopoverSubmitInput } from "~/components/tree-node-popover";
import { TreeSummaryCard } from "~/components/tree-summary-card";
import { resolveDisplayImageUrl } from "~/lib/display-image";
import type { TreeResolvedEntitiesMap } from "~/server/entity-resolver";

function formatConnectionLabel(connectionType: ConnectionTypeValue): string {
  return connectionType.replaceAll("-", " ").toUpperCase();
}

type PreviewSection = {
  id: GuideSectionIdValue | "unsectioned";
  title: string;
  description?: string;
  items: TreeItem[];
};

type PreviewBoardItem = {
  aspectRatio: number;
  chromeHeight: number;
  height: number;
  id: string;
  img: string;
  sectionId: PreviewSection["id"];
  sectionTitle: string;
  item: TreeItem;
};

export type { AddToTreeTarget };

function buildPreviewSections(tree: CultureTree): PreviewSection[] {
  if (tree.guideSections.length === 0) {
    return [{ id: "unsectioned", title: "Branches", items: tree.items }];
  }

  const sectionItemIds = new Set(
    tree.guideSections.flatMap((section) => section.items.map((item) => item.id)),
  );
  const unsectionedItems = tree.items.filter((item) => !sectionItemIds.has(item.id));
  const sections: PreviewSection[] = tree.guideSections.map((section: GuideSection) => ({
    id: section.id,
    title: section.title || formatGuideSectionTitle(section.id),
    description: section.description,
    items: section.items,
  }));

  if (unsectionedItems.length > 0) {
    sections.push({ id: "unsectioned", title: "More Branches", items: unsectionedItems });
  }

  return sections;
}

function masonryHeightForItem(item: TreeItem): number {
  switch (item.type) {
    case "album":
    case "song":
    case "person":
    case "artist":
      return 620;
    case "book":
    case "film":
    case "tv":
    case "artwork":
      return 780;
    case "place":
    case "event":
    case "article":
    case "podcast":
      return 680;
  }
}

function masonryAspectRatioForItem(item: TreeItem): number {
  switch (item.type) {
    case "album":
    case "song":
      return 1;
    case "book":
    case "film":
    case "tv":
    case "artwork":
      return 1.48;
    case "person":
    case "artist":
      return 1.1;
    case "place":
    case "event":
    case "article":
    case "podcast":
      return 0.72;
  }
}

function buildPreviewBoardItems({
  enrichments,
  resolvedEntities,
  sections,
}: {
  readonly enrichments: TreeEnrichmentsMap;
  readonly resolvedEntities: TreeResolvedEntitiesMap;
  readonly sections: readonly PreviewSection[];
}): PreviewBoardItem[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      aspectRatio: masonryAspectRatioForItem(item),
      chromeHeight: 78,
      height: masonryHeightForItem(item),
      id: `${section.id}-${item.id}`,
      img: coverSrcForItem({ item, enrichments, resolvedEntity: resolvedEntities[item.id] }) ?? "",
      item,
      sectionId: section.id,
      sectionTitle: section.title,
    })),
  );
}

function availableBranchTypes(tree: CultureTree): NodeTypeValue[] {
  return Array.from(new Set(tree.items.map((item) => item.type))).sort((left, right) =>
    left.localeCompare(right),
  );
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

function memberTooltip(count: number): string {
  return `Liked by ${count} member${count === 1 ? "" : "s"}`;
}

function LikeToggle({
  likeCount,
  liked,
  onToggle,
}: {
  readonly likeCount: number;
  readonly liked: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-pressed={liked}
            onClick={onToggle}
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-muted-foreground transition-colors hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-300/40 focus-visible:outline-none",
              liked && "text-rose-300 hover:text-rose-200",
            )}
          />
        }
      >
        <HeartIcon className={cn("size-3.5", liked && "fill-current")} aria-hidden />
        <span className="font-mono text-[0.62rem] leading-none tabular-nums">{likeCount}</span>
      </TooltipTrigger>
      <TooltipContent>
        {liked ? "You liked this · " : ""}
        {memberTooltip(likeCount)}
      </TooltipContent>
    </Tooltip>
  );
}

function coverSrcForItem({
  item,
  enrichments,
  resolvedEntity,
}: {
  readonly item: TreeItem;
  readonly enrichments: TreeEnrichmentsMap;
  readonly resolvedEntity?: TreeResolvedEntitiesMap[string];
}): string | undefined {
  const media = enrichments[item.id];
  return resolveDisplayImageUrl(item, media) ?? resolvedEntity?.imageUrl ?? undefined;
}

export function CultureTreeItemCard({
  item,
  enrichments,
  isLoading = false,
  onOpen,
  resolvedEntity,
  sectionTitle,
}: {
  readonly item: TreeItem;
  readonly enrichments: TreeEnrichmentsMap;
  readonly isLoading?: boolean;
  readonly onOpen: (item: TreeItem) => void;
  readonly resolvedEntity?: TreeResolvedEntitiesMap[string];
  readonly sectionTitle?: string;
}) {
  const itemHeading = headingFromSearchHint(item.name, item.searchHint);
  const coverSrc = coverSrcForItem({ item, enrichments, resolvedEntity });

  return (
    <article className="group h-full min-w-0">
      <button
        type="button"
        className="flex h-full w-full min-w-0 flex-col rounded-md border border-border/75 bg-card/70 p-2 text-left shadow-[0_18px_60px_-52px_rgba(20,26,16,0.65)] transition-colors duration-200 ease-out outline-none hover:border-primary/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        onClick={() => onOpen(item)}
      >
        <span className="relative block min-h-0 flex-1 overflow-hidden rounded bg-muted/30">
          <NodeThumbnail
            type={item.type}
            src={coverSrc}
            size="md"
            className="absolute inset-0 size-full rounded object-contain object-center transition duration-300 ease-out group-hover:scale-[1.018]"
          />
          {isLoading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 font-mono text-[0.6rem] tracking-[0.08em] text-muted-foreground uppercase shadow-sm">
                <LoaderCircleIcon className="size-3.5 animate-spin text-primary" aria-hidden />
                Adding
              </span>
            </span>
          ) : null}
          {resolvedEntity?.likedByCurrentUser ? (
            <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-background/88 text-rose-600 shadow-sm">
              <HeartIcon className="size-3.5 fill-current" aria-hidden />
            </span>
          ) : null}
        </span>
        <span className="block min-w-0 shrink-0 px-1 pt-2 pb-1.5">
          <span className="font-heading block truncate text-[1.05rem] leading-snug tracking-tight text-foreground">
            {itemHeading.primary}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.74rem] leading-tight text-muted-foreground">
            {itemHeading.secondary ? (
              <span className="min-w-0 truncate">{itemHeading.secondary}</span>
            ) : (
              <span>{formatConnectionLabel(item.connectionType).toLowerCase()}</span>
            )}
            {item.year != null ? (
              <span className="shrink-0 font-mono tabular-nums">{item.year}</span>
            ) : null}
          </span>
          {sectionTitle ? (
            <span className="mt-1 block truncate font-mono text-[0.58rem] tracking-[0.1em] text-muted-foreground/70 uppercase">
              {sectionTitle}
            </span>
          ) : null}
        </span>
      </button>
    </article>
  );
}

function BranchFocusDialog({
  addToTreeTargets = [],
  item,
  enrichments,
  hasNext = false,
  hasPrevious = false,
  isGeneratingNewTree,
  onClose,
  onNext,
  onPrevious,
  onAddToTree,
  onStartNewTree,
  onDeleteItem,
  onGenerateNewTree,
  onToggleLike,
  resolvedEntity,
  sourceTreeId,
}: {
  readonly addToTreeTargets?: readonly AddToTreeTarget[];
  readonly item: TreeItem | null;
  readonly enrichments: TreeEnrichmentsMap;
  readonly hasNext?: boolean;
  readonly hasPrevious?: boolean;
  readonly isGeneratingNewTree: boolean;
  readonly onClose: () => void;
  readonly onNext?: () => void;
  readonly onPrevious?: () => void;
  readonly onAddToTree?: (item: TreeItem, targetTreeId: string) => Promise<void>;
  readonly onStartNewTree?: (item: TreeItem) => Promise<void>;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
  readonly onToggleLike?: (entityId: string, liked: boolean) => Promise<void>;
  readonly resolvedEntity?: TreeResolvedEntitiesMap[string];
  readonly sourceTreeId?: string;
}) {
  const media = item ? enrichments[item.id] : undefined;
  const itemHeading = item ? headingFromSearchHint(item.name, item.searchHint) : null;
  const coverSrc = item ? coverSrcForItem({ item, enrichments, resolvedEntity }) : undefined;
  const trailerVideoId = media?.youtubeVideoId;
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);

  // Each branch opens on its poster; reset when the focused branch changes.
  useEffect(() => {
    setIsPlayingTrailer(false);
  }, [item?.id]);

  // Cycle branches with the arrow keys while the focus dialog is open.
  useEffect(() => {
    if (item == null) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea") || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext?.();
      } else if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [item, hasNext, hasPrevious, onNext, onPrevious]);

  return (
    <Dialog open={item != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={cn(
          "transition-[background-color,backdrop-filter] duration-700 ease-out",
          isPlayingTrailer && "bg-black/95 supports-backdrop-filter:backdrop-blur-md",
        )}
        className="grid h-[min(52rem,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-[min(96rem,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden rounded-2xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.18_0.012_125)] p-0 text-[oklch(0.91_0.014_125)] shadow-2xl ring-1 ring-[oklch(0.95_0.01_120/0.06)] sm:max-w-none md:grid-cols-[minmax(0,1fr)_22rem]"
      >
        {item && itemHeading ? (
          <>
            <DialogTitle className="sr-only">{itemHeading.primary}</DialogTitle>
            <DialogDescription className="sr-only">
              Branch details and connection notes for {itemHeading.primary}.
            </DialogDescription>
            <div className="relative min-h-0 bg-[oklch(0.18_0.012_125)]">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-5 left-5 z-20 rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.91_0.014_125)] transition-colors hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.91_0.014_125)]"
                onClick={onClose}
                aria-label="Back to tree"
              >
                <XIcon className="size-4" aria-hidden />
              </Button>
              {trailerVideoId && isPlayingTrailer ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-5 right-5 z-10 rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.91_0.014_125)] hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.91_0.014_125)]"
                  onClick={() => setIsPlayingTrailer(false)}
                  aria-label="Back to poster"
                >
                  <ImageIcon className="size-4" aria-hidden />
                </Button>
              ) : null}
              {hasPrevious ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute inset-y-0 left-5 z-20 my-auto rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.91_0.014_125)] transition-colors hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.91_0.014_125)] active:translate-y-0"
                  onClick={() => onPrevious?.()}
                  aria-label="Previous branch"
                >
                  <ChevronLeftIcon className="size-4" aria-hidden />
                </Button>
              ) : null}
              {hasNext ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute inset-y-0 right-5 z-20 my-auto rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.91_0.014_125)] transition-colors hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.91_0.014_125)] active:translate-y-0"
                  onClick={() => onNext?.()}
                  aria-label="Next branch"
                >
                  <ChevronRightIcon className="size-4" aria-hidden />
                </Button>
              ) : null}
              <div
                key={item.id}
                className="pointer-events-none flex h-full min-h-0 content-fade-scale items-center justify-center px-6 py-16 md:px-12"
              >
                {trailerVideoId && isPlayingTrailer ? (
                  <iframe
                    title={`${itemHeading.primary} trailer`}
                    src={`https://www.youtube-nocookie.com/embed/${trailerVideoId}?autoplay=1&rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="pointer-events-auto aspect-video max-h-full w-full max-w-5xl rounded-sm shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)]"
                  />
                ) : coverSrc ? (
                  <div className="pointer-events-auto relative inline-flex max-h-full max-w-full">
                    <img
                      alt=""
                      referrerPolicy="no-referrer"
                      src={coverSrc}
                      className="max-h-full max-w-full rounded-sm object-contain shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)]"
                    />
                    {trailerVideoId ? (
                      <button
                        type="button"
                        onClick={() => setIsPlayingTrailer(true)}
                        aria-label={`Play ${itemHeading.primary} trailer`}
                        className="group absolute inset-0 flex items-center justify-center rounded-sm bg-[oklch(0.12_0.01_125/0)] transition-colors hover:bg-[oklch(0.12_0.01_125/0.35)] focus-visible:bg-[oklch(0.12_0.01_125/0.35)] focus-visible:ring-2 focus-visible:ring-[oklch(0.82_0.11_100/0.6)] focus-visible:outline-none"
                      >
                        <span className="flex size-16 items-center justify-center rounded-full bg-[oklch(0.12_0.01_125/0.6)] text-[oklch(0.95_0.012_125)] ring-1 ring-[oklch(0.95_0.01_120/0.18)] backdrop-blur-sm transition-transform group-hover:scale-105">
                          <PlayIcon className="size-7 translate-x-0.5 fill-current" aria-hidden />
                        </span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-[min(24rem,70vw)] items-center justify-center rounded-md border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.9_0.01_120/0.45)]">
                    <NodeThumbnail
                      type={item.type}
                      size="md"
                      className="size-24 bg-transparent text-[oklch(0.9_0.01_120/0.45)]"
                    />
                  </div>
                )}
              </div>
            </div>
            <aside className="flex min-h-0 flex-col border-t border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.21_0.012_125)] md:border-t-0 md:border-l">
              <div className="flex items-center justify-between gap-2 border-b border-[oklch(0.9_0.01_120/0.1)] px-6 py-5">
                {resolvedEntity ? (
                  <LikeToggle
                    likeCount={resolvedEntity.likeCount}
                    liked={resolvedEntity.likedByCurrentUser}
                    onToggle={() =>
                      void onToggleLike?.(resolvedEntity.id, resolvedEntity.likedByCurrentUser)
                    }
                  />
                ) : (
                  <span />
                )}
                {onDeleteItem ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.9_0.01_120/0.72)] hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.94_0.01_120)]"
                          aria-label="Branch options"
                        />
                      }
                    >
                      <MoreHorizontalIcon className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          onDeleteItem(item);
                          onClose();
                        }}
                      >
                        <Trash2Icon className="size-3.5" aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <div
                key={`body-${item.id}`}
                className="min-h-0 flex-1 content-fade-rise overflow-y-auto px-6 py-6"
              >
                <div className="space-y-4">
                  <div>
                    <NodeTypeBadge
                      type={item.type}
                      className="mb-2 border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.9_0.01_120/0.72)]"
                    />
                    <h3 className="font-heading text-2xl leading-tight tracking-tight text-[oklch(0.95_0.012_125)]">
                      {itemHeading.primary}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[oklch(0.9_0.01_120/0.55)]">
                      {itemHeading.secondary ? <span>{itemHeading.secondary}</span> : null}
                      {item.year != null ? (
                        <span className="font-mono text-xs tabular-nums">{item.year}</span>
                      ) : null}
                    </div>
                  </div>

                  {item.type === "song" && media?.musicAlbumTitle ? (
                    <p className="text-sm leading-relaxed text-[oklch(0.9_0.01_120/0.58)]">
                      From the album{" "}
                      {media.musicAlbumExternalUrl ? (
                        <a
                          className="text-[oklch(0.82_0.11_100)] hover:underline"
                          href={media.musicAlbumExternalUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {media.musicAlbumTitle}
                        </a>
                      ) : (
                        <span className="text-[oklch(0.9_0.01_120/0.78)]">
                          {media.musicAlbumTitle}
                        </span>
                      )}
                    </p>
                  ) : null}

                  {item.reason ? (
                    <div className="space-y-2 pt-2">
                      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[oklch(0.9_0.01_120/0.42)] uppercase">
                        Description
                      </p>
                      <p className="font-body text-base leading-relaxed text-[oklch(0.91_0.014_125)]">
                        {item.reason}
                      </p>
                    </div>
                  ) : null}

                  {resolvedEntity &&
                  (resolvedEntity.appearsInTrees.length > 0 ||
                    resolvedEntity.privateAppearanceCount > 0) ? (
                    <div className="space-y-3 pt-2">
                      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[oklch(0.9_0.01_120/0.42)] uppercase">
                        Also appears in
                      </p>
                      <div className="space-y-3">
                        {resolvedEntity.appearsInTrees.map((appearsInTree) => (
                          <TreeSummaryCard key={appearsInTree.id} tree={appearsInTree} />
                        ))}
                      </div>
                      {resolvedEntity.privateAppearanceCount > 0 ? (
                        <p className="font-body text-sm leading-relaxed text-[oklch(0.9_0.01_120/0.55)]">
                          {resolvedEntity.appearsInTrees.length > 0 ? "and in " : "In "}
                          {resolvedEntity.privateAppearanceCount} private{" "}
                          {resolvedEntity.privateAppearanceCount === 1 ? "tree" : "trees"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                key={`footer-${item.id}`}
                className="content-fade-rise space-y-3 border-t border-[oklch(0.9_0.01_120/0.1)] px-6 py-5 [animation-delay:80ms]"
              >
                <div className="flex flex-wrap gap-2">
                  {onAddToTree && item && sourceTreeId ? (
                    <AddToTreePopover
                      sourceTreeId={sourceTreeId}
                      itemId={item.id}
                      targets={addToTreeTargets}
                      onAddToTree={(targetTreeId) => onAddToTree(item, targetTreeId)}
                      onStartNewTree={onStartNewTree ? () => onStartNewTree(item) : undefined}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] text-[oklch(0.9_0.01_120/0.72)] hover:bg-[oklch(0.95_0.01_120/0.1)] hover:text-[oklch(0.94_0.01_120)]"
                        >
                          <PlusIcon className="size-3.5" aria-hidden />
                          Add to Tree
                        </Button>
                      }
                    />
                  ) : null}
                  {onGenerateNewTree ? (
                    <Button
                      type="button"
                      variant="amber"
                      size="sm"
                      className="rounded-full"
                      disabled={isGeneratingNewTree}
                      onClick={() => void onGenerateNewTree(item)}
                    >
                      {isGeneratingNewTree ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <SparklesIcon className="size-3.5" aria-hidden />
                      )}
                      Explore This
                    </Button>
                  ) : null}
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function TreePreview({
  addToTreeTargets = [],
  tree,
  enrichments = {},
  headerActions,
  loadingItemIds = [],
  isAddItemPending = false,
  isGrowItemPending = false,
  isGeneratingNewTree = false,
  onAddBranchToTree,
  onStartNewTree,
  onAddItem,
  onDeleteItem,
  onGenerateNewTree,
  onGrowItem,
  onSuggestItems,
  onToggleLike,
  resolvedEntities = {},
  sourceTreeId,
}: {
  readonly addToTreeTargets?: readonly AddToTreeTarget[];
  readonly tree: CultureTree;
  readonly enrichments?: TreeEnrichmentsMap;
  readonly headerActions?: ReactNode;
  readonly loadingItemIds?: readonly string[];
  readonly isAddItemPending?: boolean;
  readonly isGrowItemPending?: boolean;
  readonly onAddBranchToTree?: (item: TreeItem, targetTreeId: string) => Promise<void>;
  readonly onStartNewTree?: (item: TreeItem) => Promise<void>;
  readonly onAddItem?: (node: readonly TreeNodePopoverSubmitInput[]) => Promise<void>;
  readonly onSuggestItems?: (
    trayResults: readonly TreeNodePopoverSubmitInput["result"][],
  ) => Promise<readonly TreeNodePopoverSubmitInput["result"][]>;
  readonly isGeneratingNewTree?: boolean;
  readonly onDeleteItem?: (item: TreeItem) => void;
  readonly onGenerateNewTree?: (item: TreeItem) => Promise<void>;
  readonly onGrowItem?: (node: TreeNodePopoverSubmitInput) => Promise<void>;
  readonly onToggleLike?: (entityId: string, liked: boolean) => Promise<void>;
  readonly resolvedEntities?: TreeResolvedEntitiesMap;
  readonly sourceTreeId?: string;
}) {
  const [selectedBranchTypes, setSelectedBranchTypes] = useState<NodeTypeValue[]>([]);
  const branchTypes = availableBranchTypes(tree);
  const allBranchTypesSelected = selectedBranchTypes.length === 0;
  const filteredTree = allBranchTypesSelected
    ? tree
    : filterCultureTreeToNodeTypes(tree, selectedBranchTypes);
  const previewSections = buildPreviewSections(filteredTree).filter(
    (section) => section.items.length > 0 || section.id !== "unsectioned",
  );
  const boardItems = buildPreviewBoardItems({
    enrichments,
    resolvedEntities,
    sections: previewSections,
  });
  const loadingItemIdSet = new Set(loadingItemIds);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const selectedIndex = selectedBoardId
    ? boardItems.findIndex((board) => board.id === selectedBoardId)
    : -1;
  const selectedItem = selectedIndex >= 0 ? boardItems[selectedIndex].item : null;
  const selectedResolvedEntity = selectedItem ? resolvedEntities[selectedItem.id] : undefined;
  const goToBoardOffset = (offset: number) => {
    setSelectedBoardId((current) => {
      const index = current ? boardItems.findIndex((board) => board.id === current) : -1;
      const next = index + offset;
      if (index < 0 || next < 0 || next >= boardItems.length) {
        return current;
      }
      return boardItems[next].id;
    });
  };
  const filterActive = !allBranchTypesSelected;
  const toggleBranchType = (type: NodeTypeValue) => {
    setSelectedBranchTypes((current) => {
      if (current.length === 0) {
        return [type];
      }
      if (current.includes(type)) {
        return current.length === 1 ? [] : current.filter((item) => item !== type);
      }
      return [...current, type];
    });
  };

  return (
    <section className="relative w-full text-left">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {branchTypes.length > 0 ? (
          <div>
            <NodeTypeFilterList
              types={branchTypes}
              selectedTypes={selectedBranchTypes}
              allSelected={allBranchTypesSelected}
              allLabel="All Branches"
              size="md"
              onSelectAll={() => setSelectedBranchTypes([])}
              onToggleType={toggleBranchType}
            />
          </div>
        ) : (
          <span />
        )}
        {(onAddItem || onGrowItem || onSuggestItems || headerActions) && (
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            {onAddItem || onGrowItem || onSuggestItems ? (
              <TreeNodeDialog
                triggerLabel="Add Branch"
                triggerIcon={<PlusIcon className="size-3.5" />}
                triggerVariant="outline"
                title="Add Branch"
                existingBranches={tree.items}
                isPending={isAddItemPending}
                isAiPending={isGrowItemPending}
                onSuggestBranches={onSuggestItems}
                onSubmit={
                  onAddItem ??
                  (async (nodes) => {
                    const node = nodes.at(0);
                    if (node && onGrowItem) {
                      await onGrowItem(node);
                    }
                  })
                }
                onAiSubmit={onGrowItem}
              />
            ) : null}
            {headerActions}
          </div>
        )}
      </div>
      {boardItems.length > 0 ? (
        <Masonry
          items={boardItems}
          animateFrom="bottom"
          blurToFocus
          duration={0.6}
          ease="power3.out"
          hoverScale={0.97}
          scaleOnHover
          stagger={0.035}
          renderItem={({ id, item, sectionTitle }) => (
            <CultureTreeItemCard
              enrichments={enrichments}
              isLoading={loadingItemIdSet.has(item.id)}
              item={item}
              onOpen={() => setSelectedBoardId(id)}
              resolvedEntity={resolvedEntities[item.id]}
              sectionTitle={sectionTitle}
            />
          )}
        />
      ) : filterActive ? (
        <div className="mx-auto flex min-h-48 w-full max-w-xl flex-col items-center justify-center rounded border border-border/60 bg-muted/20 px-4 py-8 text-center">
          <p className="font-heading text-xl tracking-tight text-foreground">
            No Branches match those filters.
          </p>
          <p className="font-body mt-2 text-sm text-muted-foreground">
            Show every Branch again to keep browsing this Culture Tree.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-sm font-mono text-[0.65rem] tracking-[0.08em] uppercase"
            onClick={() => setSelectedBranchTypes([])}
          >
            Show all Branches
          </Button>
        </div>
      ) : (
        <p className="font-body mt-4 text-center text-sm text-muted-foreground">No items yet.</p>
      )}
      <BranchFocusDialog
        addToTreeTargets={addToTreeTargets}
        enrichments={enrichments}
        hasNext={selectedIndex >= 0 && selectedIndex < boardItems.length - 1}
        hasPrevious={selectedIndex > 0}
        isGeneratingNewTree={isGeneratingNewTree}
        item={selectedItem}
        onAddToTree={onAddBranchToTree}
        onStartNewTree={onStartNewTree}
        onClose={() => setSelectedBoardId(null)}
        onNext={() => goToBoardOffset(1)}
        onPrevious={() => goToBoardOffset(-1)}
        onDeleteItem={onDeleteItem}
        onGenerateNewTree={onGenerateNewTree}
        onToggleLike={onToggleLike}
        resolvedEntity={selectedResolvedEntity}
        sourceTreeId={sourceTreeId}
      />
    </section>
  );
}
