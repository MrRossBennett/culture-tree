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
import { ExternalLinkIcon, SproutIcon, StarIcon, Trash2Icon } from "lucide-react";

import { NodeThumbnail, nodeTypeIcon } from "~/components/node-thumbnail";

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
        "relative",
        variant === "default" && "rounded border border-border/70 bg-card/90 px-5 py-5",
        variant === "flow" &&
          cn(
            "rounded border border-primary/40 bg-card/95 px-7 py-6 md:px-10 md:py-8",
            "shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_38%,transparent),0_0_64px_-12px_color-mix(in_srgb,var(--primary)_45%,transparent)]",
          ),
      )}
    >
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono tracking-[0.12em] text-primary uppercase",
          variant === "default" && "text-[0.6rem]",
          variant === "flow" && "gap-x-2.5 gap-y-1.5 text-xs tracking-[0.14em] md:text-[0.8rem]",
        )}
      >
        <SproutIcon
          className={cn(
            variant === "default" && "size-3",
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
          "font-heading leading-[1.08] text-card-foreground",
          variant === "default" && "text-3xl tracking-tight md:text-5xl",
          variant === "flow" && "text-3xl tracking-tight md:text-6xl lg:text-7xl",
          seedHeading.secondary && "mb-1",
        )}
      >
        {seedHeading.primary}
      </h2>
      {seedHeading.secondary ? (
        <p
          className={cn(
            "font-body font-normal text-muted-foreground",
            variant === "default" && "text-base md:text-2xl",
            variant === "flow" && "text-lg md:text-3xl lg:text-4xl",
          )}
        >
          {seedHeading.secondary}
        </p>
      ) : null}
      {tree.reason ? (
        <p
          className={cn(
            "font-body leading-relaxed text-muted-foreground italic",
            variant === "default" && "mt-3 text-sm",
            variant === "flow" && "mt-3 text-base md:mt-4 md:text-lg",
          )}
        >
          {tree.reason}
        </p>
      ) : null}
      <p
        className={cn(
          "font-mono tracking-[0.08em] text-muted-foreground/70 uppercase",
          variant === "default" && "mt-4 text-[0.6rem]",
          variant === "flow" && "mt-5 text-[0.65rem] md:tracking-[0.12em]",
        )}
      >
        {branchCount} branches · {formatSourceFooter(sources)} · {formatTypesFooter(types)}
      </p>
      {onAddBranch ? (
        <div className={cn(variant === "default" && "mt-4", variant === "flow" && "mt-5")}>
          <button
            type="button"
            onClick={onAddBranch}
            className="rounded-sm border border-border/70 px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.04em] text-muted-foreground uppercase transition-colors hover:border-border hover:text-foreground"
          >
            Grow a new branch
          </button>
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
  const coverSrc = media?.coverUrl ?? media?.thumbnailUrl ?? node.snapshot?.image;

  return (
    <>
      <div style={{ marginLeft: indent }}>
        <div className="overflow-hidden rounded border border-border/70 bg-card/80">
          <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[0.6rem] tracking-[0.08em] text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5 text-foreground/80">
                {nodeTypeIcon(node.type, "size-3.5 shrink-0 opacity-80")}
                {formatTypeLabel(node.type)}
              </span>
              <span
                className="rounded-sm border border-border/60 px-1.5 py-px text-[0.58rem] tracking-wide"
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
          <div className="flex gap-0">
            <NodeThumbnail
              type={node.type}
              src={coverSrc}
              size="md"
              className="border-r border-border/60"
            />
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="font-heading text-lg leading-snug tracking-tight text-card-foreground md:text-2xl">
                  {nodeHeading.primary}
                </h3>
                {node.year != null ? (
                  <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
                    {node.year}
                  </span>
                ) : null}
              </div>
              {nodeHeading.secondary ? (
                <p className="mb-2 font-mono text-[0.7rem] tracking-wide text-primary/80">
                  {nodeHeading.secondary}
                </p>
              ) : null}
              {node.type === "song" && media?.musicAlbumTitle ? (
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
              {node.reason ? (
                <p className="font-body mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/80 italic">
                  {node.reason}
                </p>
              ) : null}
              {/* {media?.description ? (
                <p className="font-body mt-1.5 line-clamp-2 text-[0.8rem] leading-relaxed text-muted-foreground">
                  {media.description}
                </p>
              ) : null}
              {media?.wikiExtract && !media.description ? (
                <p className="font-body mt-1.5 line-clamp-2 text-[0.8rem] leading-relaxed text-muted-foreground">
                  {media.wikiExtract}
                </p>
              ) : null} */}
              {onAddChild ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onAddChild(nodeId, node)}
                    className="rounded-sm border border-border/70 px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.04em] text-muted-foreground uppercase transition-colors hover:border-border hover:text-foreground"
                  >
                    Where next?
                  </button>
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
    <div className="w-full max-w-4xl text-left">
      <CultureTreeSeedCard tree={tree} onAddBranch={onAddBranch} />
      {tree.children.length > 0 ? (
        <div className="relative mt-8">
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
