import type {
  ConnectionTypeValue,
  CultureTree,
  EnrichedMedia,
  NodeSourceValue,
  NodeTypeValue,
  SearchHint,
  TreeEnrichmentsMap,
  TreeNode,
} from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import {
  BookOpenIcon,
  CalendarIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  Trash2Icon,
  Disc3Icon,
  ImageIcon,
  LibraryBigIcon,
  MapPinIcon,
  MusicIcon,
  NewspaperIcon,
  PodcastIcon,
  SproutIcon,
  StarIcon,
  TvIcon,
  UserIcon,
} from "lucide-react";

function countBranchNodes(nodes: readonly TreeNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countBranchNodes(n.children), 0);
}

function collectBranchTypes(nodes: readonly TreeNode[]): Set<NodeTypeValue> {
  const s = new Set<NodeTypeValue>();
  for (const n of nodes) {
    s.add(n.type);
    for (const t of collectBranchTypes(n.children)) s.add(t);
  }
  return s;
}

function collectBranchSources(nodes: readonly TreeNode[]): Set<NodeSourceValue> {
  const s = new Set<NodeSourceValue>();
  for (const n of nodes) {
    s.add(n.source);
    for (const src of collectBranchSources(n.children)) s.add(src);
  }
  return s;
}

function formatConnectionLabel(c: ConnectionTypeValue): string {
  return c.replaceAll("-", " ").toUpperCase();
}

function formatTypeLabel(t: NodeTypeValue): string {
  return t.toUpperCase();
}

function formatSourceFooter(sources: Set<NodeSourceValue>): string {
  if (sources.size === 0) return "—";
  if (sources.size > 1) return "mixed sources";
  const [only] = sources;
  if (only === "ai-expanded") return "expanded";
  return only;
}

function formatTypesFooter(types: Set<NodeTypeValue>): string {
  if (types.size === 0) return "—";
  if (types.size > 1) return "Mixed";
  const [only] = types;
  return formatTypeLabel(only);
}

/** Two-line heading when searchHint splits title vs creator; else single-line display name. */
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

function nodeTypeIcon(type: NodeTypeValue, iconClassName = "size-3.5 shrink-0 opacity-80") {
  switch (type) {
    case "album":
      return <Disc3Icon className={iconClassName} aria-hidden />;
    case "film":
      return <ClapperboardIcon className={iconClassName} aria-hidden />;
    case "book":
      return <BookOpenIcon className={iconClassName} aria-hidden />;
    case "song":
      return <MusicIcon className={iconClassName} aria-hidden />;
    case "tv":
      return <TvIcon className={iconClassName} aria-hidden />;
    case "artist":
    case "person":
      return <UserIcon className={iconClassName} aria-hidden />;
    case "podcast":
      return <PodcastIcon className={iconClassName} aria-hidden />;
    case "artwork":
      return <ImageIcon className={iconClassName} aria-hidden />;
    case "place":
      return <MapPinIcon className={iconClassName} aria-hidden />;
    case "event":
      return <CalendarIcon className={iconClassName} aria-hidden />;
    case "article":
      return <NewspaperIcon className={iconClassName} aria-hidden />;
    case "publication":
      return <LibraryBigIcon className={iconClassName} aria-hidden />;
  }
}

export function CultureTreeSeedCard({
  tree,
  variant = "default",
  onAddBranch,
}: {
  readonly tree: CultureTree;
  readonly variant?: "default" | "flow";
  readonly onAddBranch?: () => void;
}) {
  const branchCount = countBranchNodes(tree.children);
  const types = collectBranchTypes(tree.children);
  const sources = collectBranchSources(tree.children);
  const seedHeading = headingFromSearchHint(tree.name, tree.searchHint);

  return (
    <div
      className={cn(
        "relative backdrop-blur-sm",
        variant === "default" &&
          "rounded-2xl border border-border/80 bg-card/90 px-5 py-4 shadow-sm",
        variant === "flow" &&
          cn(
            "rounded-3xl border border-primary/40 bg-card/95 px-7 py-6 md:px-10 md:py-8",
            "shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_38%,transparent),0_0_64px_-12px_color-mix(in_srgb,var(--primary)_45%,transparent)]",
          ),
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 font-mono tracking-[0.12em] text-primary uppercase",
          variant === "default" && "text-[0.65rem]",
          variant === "flow" && "gap-x-2.5 gap-y-1.5 text-xs tracking-[0.14em] md:text-[0.8rem]",
        )}
      >
        <SproutIcon
          className={cn(
            variant === "default" && "size-3.5",
            variant === "flow" && "size-4 md:size-5",
          )}
          aria-hidden
        />
        <span>Seed</span>
        {tree.year != null ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-normal text-muted-foreground">{tree.year}</span>
          </>
        ) : null}
      </div>
      <h2
        className={cn(
          "font-heading mt-3 leading-[1.08] text-card-foreground",
          variant === "default" && "text-xl md:text-5xl",
          variant === "flow" && "mt-4 text-3xl md:mt-5 md:text-6xl lg:text-7xl",
        )}
      >
        <span className="block">{seedHeading.primary}</span>
        {seedHeading.secondary ? (
          <span
            className={cn(
              "font-body mt-1 block font-normal text-muted-foreground",
              variant === "default" && "text-lg md:mt-2 md:text-3xl",
              variant === "flow" && "mt-2 text-xl md:mt-3 md:text-4xl lg:text-5xl",
            )}
          >
            {seedHeading.secondary}
          </span>
        ) : null}
      </h2>
      {tree.reason ? (
        <p
          className={cn(
            "font-body leading-relaxed text-muted-foreground italic",
            variant === "default" && "mt-2 text-sm",
            variant === "flow" && "mt-3 text-base md:mt-4 md:text-lg",
          )}
        >
          {tree.reason}
        </p>
      ) : null}
      <p
        className={cn(
          "font-mono tracking-widest text-muted-foreground uppercase",
          variant === "default" && "mt-4 text-[0.65rem]",
          variant === "flow" && "mt-5 text-[0.7rem] md:text-xs md:tracking-[0.2em]",
        )}
      >
        {branchCount} branches · {formatSourceFooter(sources)} · {formatTypesFooter(types)}
      </p>
      {onAddBranch ? (
        <div className={cn(variant === "default" && "mt-4", variant === "flow" && "mt-5")}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={onAddBranch}
          >
            Grow a new branch
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function pickPrimaryLink(media: EnrichedMedia | undefined): string | undefined {
  if (!media) {
    return undefined;
  }
  return media.externalUrl ?? media.wikipediaUrl ?? media.youtubeUrl;
}

export function CultureTreeBranchNodeCard({
  node,
  depth,
  nodeId,
  enrichments,
  layout = "list",
  onAddChild,
  onDeleteNode,
}: {
  readonly node: TreeNode;
  readonly depth: number;
  readonly nodeId: string;
  readonly enrichments: TreeEnrichmentsMap;
  readonly layout?: "list" | "flow";
  readonly onAddChild?: (nodeId: string, node: TreeNode) => void;
  readonly onDeleteNode?: (nodeId: string, node: TreeNode) => void;
}) {
  const indent = layout === "flow" ? 0 : Math.min(depth, 4) * 14;
  const media = enrichments[nodeId];
  const link = pickPrimaryLink(media);
  const nodeHeading = headingFromSearchHint(node.name, node.searchHint);
  const squareCoverThumb = node.type === "person" || node.type === "album" || node.type === "song";
  const coverSrc = media?.coverUrl ?? media?.thumbnailUrl ?? node.snapshot?.image;

  return (
    <>
      <div style={{ marginLeft: indent }}>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5 text-foreground/90">
                {nodeTypeIcon(node.type)}
                {formatTypeLabel(node.type)}
              </span>
              <span
                className="rounded-full border border-border/60 bg-secondary/60 px-2 py-px text-[0.6rem] tracking-wide text-secondary-foreground"
                title="Relationship to seed branch"
              >
                {formatConnectionLabel(node.connectionType)}
              </span>
              {media?.rating != null ? (
                <span className="inline-flex items-center gap-0.5 tracking-normal text-foreground/80 normal-case tabular-nums">
                  <StarIcon className="size-3.5 text-amber-500/90" aria-hidden />
                  {media.rating.toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {link ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                  render={
                    <a
                      href={link}
                      rel="noreferrer"
                      target="_blank"
                      aria-label={`Open source for ${node.name}`}
                    />
                  }
                  nativeButton={false}
                >
                  <ExternalLinkIcon className="size-3.5" aria-hidden />
                </Button>
              ) : null}
              {onDeleteNode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onDeleteNode(nodeId, node)}
                  aria-label={`Delete branch ${node.name}`}
                >
                  <Trash2Icon className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex gap-3">
            {coverSrc ? (
              <img
                alt=""
                className={
                  squareCoverThumb
                    ? `size-16 shrink-0 border border-border/60 object-cover md:size-20 ${
                        node.type === "album" ? "rounded-none" : "rounded-md"
                      }`
                    : "max-h-40 w-16 shrink-0 self-start rounded border border-border/60 object-contain object-top-left md:max-h-48 md:w-20"
                }
                height={squareCoverThumb ? 80 : undefined}
                referrerPolicy="no-referrer"
                src={coverSrc}
                width={squareCoverThumb ? 80 : undefined}
              />
            ) : (
              <div
                className={`flex size-16 shrink-0 items-center justify-center border border-border/60 bg-muted/35 text-muted-foreground md:size-20 ${
                  node.type === "album" ? "rounded-none" : "rounded-md"
                }`}
                aria-hidden
              >
                {nodeTypeIcon(node.type, "size-7 shrink-0 opacity-80 md:size-8")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-mono text-card-foreground md:text-xl">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug">
                  <span>{nodeHeading.primary}</span>
                  {node.year != null ? (
                    <span className="inline-block shrink-0 rounded-sm border border-border/60 bg-secondary/80 px-1.5 py-0.5 font-mono text-[0.65rem] tracking-normal text-muted-foreground normal-case tabular-nums md:text-[0.7rem]">
                      {node.year}
                    </span>
                  ) : null}
                </span>
                {nodeHeading.secondary ? (
                  <span className="mt-1 block text-sm leading-snug font-normal text-muted-foreground md:text-base">
                    {nodeHeading.secondary}
                  </span>
                ) : null}
              </h3>
              {node.type === "song" && media?.musicAlbumTitle ? (
                <p className="font-body mt-1.5 text-xs leading-snug tracking-normal text-muted-foreground normal-case">
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
              {node.reason ? (
                <p className="font-body mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground italic">
                  {node.reason}
                </p>
              ) : null}
              {media?.description ? (
                <p className="font-body mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                  {media.description}
                </p>
              ) : null}
              {media?.wikiExtract && !media.description ? (
                <p className="font-body mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                  {media.wikiExtract}
                </p>
              ) : null}
              {onAddChild ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {onAddChild ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => onAddChild(nodeId, node)}
                    >
                      Where next?
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {node.children.length > 0 && layout !== "flow"
        ? node.children.map((child, i) => (
            <CultureTreeBranchNodeCard
              key={`${nodeId}-${i}`}
              depth={depth + 1}
              enrichments={enrichments}
              layout={layout}
              node={child}
              nodeId={`${nodeId}-${i}`}
              onAddChild={onAddChild}
              onDeleteNode={onDeleteNode}
            />
          ))
        : null}
    </>
  );
}

export function TreePreview({
  tree,
  enrichments = {},
  onAddBranch,
  onAddChild,
  onDeleteNode,
}: {
  readonly tree: CultureTree;
  readonly enrichments?: TreeEnrichmentsMap;
  readonly onAddBranch?: () => void;
  readonly onAddChild?: (nodeId: string, node: TreeNode) => void;
  readonly onDeleteNode?: (nodeId: string, node: TreeNode) => void;
}) {
  return (
    <div className="w-full max-w-3xl text-left">
      <CultureTreeSeedCard tree={tree} onAddBranch={onAddBranch} />
      {tree.children.length > 0 ? (
        <div className="relative mt-8 pl-6 md:pl-8">
          <div
            className="pointer-events-none absolute top-0 bottom-6 left-[15px] w-px bg-border md:left-[19px]"
            aria-hidden
          />
          <div className="space-y-6">
            {tree.children.map((child, i) => (
              <CultureTreeBranchNodeCard
                key={`root-${i}`}
                depth={0}
                enrichments={enrichments}
                node={child}
                nodeId={`root-${i}`}
                onAddChild={onAddChild}
                onDeleteNode={onDeleteNode}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="font-body mt-6 text-sm text-muted-foreground">No branches yet.</p>
      )}
    </div>
  );
}
