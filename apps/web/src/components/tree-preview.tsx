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
import {
  BookOpenIcon,
  CalendarIcon,
  ClapperboardIcon,
  Disc3Icon,
  ExternalLinkIcon,
  ImageIcon,
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

function nodeTypeIcon(type: NodeTypeValue) {
  const className = "size-3.5 shrink-0 opacity-80";
  switch (type) {
    case "album":
      return <Disc3Icon className={className} aria-hidden />;
    case "film":
      return <ClapperboardIcon className={className} aria-hidden />;
    case "book":
      return <BookOpenIcon className={className} aria-hidden />;
    case "song":
      return <MusicIcon className={className} aria-hidden />;
    case "tv":
      return <TvIcon className={className} aria-hidden />;
    case "artist":
    case "person":
      return <UserIcon className={className} aria-hidden />;
    case "podcast":
      return <PodcastIcon className={className} aria-hidden />;
    case "artwork":
      return <ImageIcon className={className} aria-hidden />;
    case "place":
      return <MapPinIcon className={className} aria-hidden />;
    case "event":
      return <CalendarIcon className={className} aria-hidden />;
    case "article":
      return <NewspaperIcon className={className} aria-hidden />;
  }
}

function SeedCard({ tree }: { readonly tree: CultureTree }) {
  const branchCount = countBranchNodes(tree.children);
  const types = collectBranchTypes(tree.children);
  const sources = collectBranchSources(tree.children);
  const seedHeading = headingFromSearchHint(tree.name, tree.searchHint);

  return (
    <div className="relative rounded-2xl border border-border/80 bg-card/90 px-5 py-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.65rem] tracking-[0.12em] text-primary uppercase">
        <SproutIcon className="size-3.5" aria-hidden />
        <span>Seed</span>
        {tree.year != null ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-normal text-muted-foreground">{tree.year}</span>
          </>
        ) : null}
      </div>
      <h2 className="font-heading mt-3 text-xl leading-tight text-card-foreground md:text-5xl">
        <span className="block">{seedHeading.primary}</span>
        {seedHeading.secondary ? (
          <span className="font-body mt-1 block text-lg font-normal text-muted-foreground md:mt-2 md:text-3xl">
            {seedHeading.secondary}
          </span>
        ) : null}
      </h2>
      {tree.reason ? (
        <p className="font-body mt-2 text-sm leading-relaxed text-muted-foreground italic">
          {tree.reason}
        </p>
      ) : null}
      <p className="mt-4 font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase">
        {branchCount} nodes · {formatSourceFooter(sources)} · {formatTypesFooter(types)}
      </p>
    </div>
  );
}

function pickPrimaryLink(media: EnrichedMedia | undefined): string | undefined {
  if (!media) {
    return undefined;
  }
  return media.externalUrl ?? media.wikipediaUrl ?? media.youtubeUrl;
}

function NodeCard({
  node,
  depth,
  nodeId,
  enrichments,
}: {
  readonly node: TreeNode;
  readonly depth: number;
  readonly nodeId: string;
  readonly enrichments: TreeEnrichmentsMap;
}) {
  const indent = Math.min(depth, 4) * 14;
  const media = enrichments[nodeId];
  const link = pickPrimaryLink(media);
  const nodeHeading = headingFromSearchHint(node.name, node.searchHint);

  return (
    <>
      <div className="relative" style={{ marginLeft: indent }}>
        {node.year != null ? (
          <div className="absolute top-6 right-full z-10 mr-2 font-mono text-[0.6rem] text-muted-foreground tabular-nums">
            <span className="inline-block rounded-sm border border-border/60 bg-secondary/80 px-1.5 py-0.5">
              {node.year}
            </span>
          </div>
        ) : null}
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm backdrop-blur-sm">
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
            {link ? (
              <a
                className="ml-auto inline-flex items-center gap-1 tracking-normal text-primary normal-case hover:underline"
                href={link}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLinkIcon className="size-3.5" aria-hidden />
                Open
              </a>
            ) : null}
          </div>
          <div className="mt-2.5 flex gap-3">
            {(media?.coverUrl ?? media?.thumbnailUrl) ? (
              <img
                alt=""
                className={
                  node.type === "book"
                    ? "max-h-40 w-16 shrink-0 self-start rounded-md border border-border/60 object-contain object-top-left md:max-h-48 md:w-20"
                    : "size-16 shrink-0 rounded-md border border-border/60 object-cover md:size-20"
                }
                height={node.type === "book" ? undefined : 80}
                referrerPolicy="no-referrer"
                src={media.coverUrl ?? media.thumbnailUrl}
                width={node.type === "book" ? undefined : 80}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="font-mono text-card-foreground md:text-xl">
                <span className="block leading-snug">{nodeHeading.primary}</span>
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
            </div>
          </div>
        </div>
      </div>
      {node.children.length > 0
        ? node.children.map((child, i) => (
            <NodeCard
              key={`${nodeId}-${i}`}
              depth={depth + 1}
              enrichments={enrichments}
              node={child}
              nodeId={`${nodeId}-${i}`}
            />
          ))
        : null}
    </>
  );
}

export function TreePreview({
  tree,
  enrichments = {},
}: {
  readonly tree: CultureTree;
  readonly enrichments?: TreeEnrichmentsMap;
}) {
  return (
    <div className="w-full max-w-3xl text-left">
      <SeedCard tree={tree} />
      {tree.children.length > 0 ? (
        <div className="relative mt-8 pl-6 md:pl-8">
          <div
            className="pointer-events-none absolute top-0 bottom-6 left-[15px] w-px bg-border md:left-[19px]"
            aria-hidden
          />
          <div className="space-y-6">
            {tree.children.map((child, i) => (
              <NodeCard
                key={`root-${i}`}
                depth={0}
                enrichments={enrichments}
                node={child}
                nodeId={`root-${i}`}
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
