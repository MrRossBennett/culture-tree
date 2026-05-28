import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { type CultureTree, type NodeTypeValue, type TreeItem } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { ButtonGroup } from "@repo/ui/components/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { LoaderCircleIcon, RefreshCwIcon, SproutIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  CultureTreeToneSelector,
  type CultureTreeTone,
} from "~/components/culture-tree-tone-selector";
import { DeleteTreeNodeDialog } from "~/components/delete-tree-node-dialog";
import {
  CULTURE_TREE_NODE_TYPES,
  CulturalMixSelector,
  mediaFilterFromSelectedNodeTypes,
} from "~/components/node-type-filter-list";
import type { TreeNodePopoverSubmitInput } from "~/components/tree-node-popover";
import { TreePreview, type AddToTreeTarget } from "~/components/tree-preview";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { loaderContainsCommittedTree, treeForVisiblePreview } from "~/lib/tree-preview-state";
import {
  $addCultureTreeNode,
  $addManualCultureTreeBranches,
  $addPublicCultureTreeBranchToMyTree,
  $deleteCultureTreeNode,
  $getCultureTreeById,
  $setCultureTreePublic,
} from "~/server/culture-trees";
import { $likeEntity, $unlikeEntity } from "~/server/entity-resolver";
import { $retryCultureTreeGeneration, $seedTreeFromItem } from "~/server/generate-culture-tree";
import {
  isGenerationActive,
  isGenerationTerminal,
} from "~/server/progressive-tree-generation-lifecycle";

export const Route = createFileRoute("/tree/$treeId")({
  loader: async ({ params, context }) => {
    const row = await $getCultureTreeById({ data: { treeId: params.treeId } });
    if (!row) {
      throw notFound();
    }
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });
    return {
      treeId: row.treeId,
      tree: row.tree,
      username: row.username,
      enrichments: row.enrichments,
      resolvedEntities: row.resolvedEntities,
      isOwner: user?.id === row.userId,
      viewerUserId: user?.id ?? null,
      isPublic: row.isPublic,
      generation: row.generation,
    };
  },
  component: TreePage,
});

function ProgressiveGenerationPanel({
  status,
  stage,
  error,
  branchCount,
  isRetryPending,
  onRetry,
}: {
  readonly status: string;
  readonly stage?: string | null;
  readonly error?: string | null;
  readonly branchCount: number;
  readonly isRetryPending: boolean;
  readonly onRetry: () => void;
}) {
  const failed = status === "failed";
  const title = failed ? "This tree paused before it finished." : (stage ?? "Growing the tree");
  const detail = failed
    ? (error ?? "The draft is still here and can be tried again.")
    : branchCount > 0
      ? "New branches are being checked and added."
      : "The first branches are being shaped now.";

  return (
    <section className="mx-auto w-full max-w-4xl rounded border border-border/70 bg-muted/20 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {failed ? (
            <RefreshCwIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <LoaderCircleIcon
              className="mt-1 size-4 shrink-0 animate-spin text-primary"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p className="font-heading text-lg leading-tight text-foreground">{title}</p>
            <p className="font-body mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
          </div>
        </div>
        {failed ? (
          <Button
            type="button"
            variant="amber"
            size="sm"
            disabled={isRetryPending}
            onClick={onRetry}
            className="shrink-0 rounded-sm font-mono text-[0.65rem] tracking-[0.08em] uppercase"
          >
            {isRetryPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              "Try again"
            )}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function LoadingBranchCards() {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="min-h-44 rounded-[1.4rem] border border-border/60 bg-card/70 px-4 py-4"
        >
          <div className="mb-4 flex items-center gap-2">
            <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />
            <div className="h-2 w-28 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-5/6 animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-2/3 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CultureTreeSeedCard({
  tree,
  ownerUsername,
  visibilityControl,
}: {
  readonly tree: CultureTree;
  readonly ownerUsername?: string | null;
  readonly visibilityControl?: ReactNode;
}) {
  const byline = ownerUsername?.trim() ? `by ${ownerUsername.trim()}` : null;
  const seed = tree.seed?.trim();
  const title = tree.title?.trim();
  const heading = title || seed || "Untitled tree";
  const description = tree.description?.trim();

  return (
    <section className="w-full">
      <div className="flex min-w-0 flex-col gap-4 border-b border-border/55 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary">
            <SproutIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-heading min-w-0 truncate text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
                {heading}
              </h1>
              {byline ? (
                <p className="font-body shrink-0 text-sm text-muted-foreground italic md:text-base">
                  {byline}
                </p>
              ) : null}
            </div>
            {description ? (
              <p className="font-body mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {visibilityControl ? <div className="shrink-0 sm:pb-1">{visibilityControl}</div> : null}
      </div>
    </section>
  );
}

function TreeVisibilityToggle({
  isPublic,
  isPending,
  onChange,
}: {
  readonly isPublic: boolean;
  readonly isPending: boolean;
  readonly onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <span className="font-mono text-[0.6rem] tracking-wide text-muted-foreground/60 uppercase">
        Link
      </span>
      <ButtonGroup aria-label="Tree link visibility" className="rounded">
        <Button
          type="button"
          size="xs"
          variant={isPublic ? "outline" : "default"}
          aria-pressed={!isPublic}
          disabled={isPending}
          onClick={() => {
            if (isPublic) {
              onChange(false);
            }
          }}
          className="font-mono text-[0.6rem] tracking-[0.06em] uppercase"
        >
          Private
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isPublic ? "default" : "outline"}
          aria-pressed={isPublic}
          disabled={isPending}
          onClick={() => {
            if (!isPublic) {
              onChange(true);
            }
          }}
          className="font-mono text-[0.6rem] tracking-[0.06em] uppercase"
        >
          Public
        </Button>
      </ButtonGroup>
    </div>
  );
}

type PendingTreeItem = TreeItem;

function pendingTreeItemFromInput(input: TreeNodePopoverSubmitInput): PendingTreeItem {
  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { identity, searchHint, snapshot } = input.result;

  return {
    id,
    name: snapshot.name,
    type: snapshot.type,
    year: snapshot.year,
    reason: "",
    connectionType: input.connectionType,
    searchHint,
    identity,
    snapshot,
    source: "user",
  };
}

function TreePage() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    tree,
    username,
    enrichments,
    resolvedEntities,
    isOwner,
    viewerUserId,
    treeId,
    isPublic,
    generation,
  } = Route.useLoaderData();
  const [generatingItem, setGeneratingItem] = useState<TreeItem | null>(null);
  const [selectedGenerationTypes, setSelectedGenerationTypes] = useState<NodeTypeValue[]>([
    ...CULTURE_TREE_NODE_TYPES,
  ]);
  const [generationTone, setGenerationTone] = useState<CultureTreeTone>("mixed");
  const [deleteTarget, setDeleteTarget] = useState<TreeItem | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingTreeItem[]>([]);
  const [committedTreeState, setCommittedTreeState] = useState<{
    treeId: string;
    tree: CultureTree;
  } | null>(null);
  const treeIsReady = generation.status === "ready";
  const committedTree =
    committedTreeState?.treeId === treeId &&
    !loaderContainsCommittedTree({ loaderTree: tree, committedTree: committedTreeState.tree })
      ? committedTreeState.tree
      : null;
  const myTrees = useQuery({
    ...myCultureTreesQueryOptions(),
    enabled: Boolean(viewerUserId && !isOwner && treeIsReady),
  });
  const addToTreeTargets: AddToTreeTarget[] = (myTrees.data?.trees ?? [])
    .filter((target) => target.id !== treeId && target.generationStatus === "ready")
    .map((target) => ({
      id: target.id,
      title: target.listTitle,
    }));

  const retryGeneration = useMutation({
    mutationFn: () => $retryCultureTreeGeneration({ data: { treeId } }),
    onSuccess: async () => {
      toast.success("Tree generation resumed.");
      await router.invalidate();
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not retry this tree.");
    },
  });

  const setPublic = useMutation({
    mutationFn: (next: boolean) => $setCultureTreePublic({ data: { treeId, isPublic: next } }),
    onSuccess: async (_, next) => {
      toast.success(next ? "Anyone with the link can view this tree." : "Tree is private again.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update visibility.");
    },
  });

  const addItem = useMutation({
    mutationFn: (input: {
      nodes: readonly TreeNodePopoverSubmitInput[];
      pendingItemIds: readonly string[];
    }) => {
      return $addManualCultureTreeBranches({ data: { treeId, nodes: [...input.nodes] } });
    },
    onSuccess: async (result, variables) => {
      setCommittedTreeState({ treeId, tree: result.tree });
      toast.success(
        result.branches.length === 1
          ? "Branch added to your tree."
          : "Branches added to your tree.",
      );
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
      const committedPendingIds = new Set(variables.pendingItemIds);
      setPendingItems((items) => items.filter((item) => !committedPendingIds.has(item.id)));
    },
    onError: (err: Error, variables) => {
      const failedPendingIds = new Set(variables.pendingItemIds);
      setPendingItems((items) => items.filter((item) => !failedPendingIds.has(item.id)));
      toast.error(err.message || "Could not add that branch.");
    },
  });

  const addPublicBranch = useMutation({
    mutationFn: (input: { item: TreeItem; targetTreeId: string }) => {
      return $addPublicCultureTreeBranchToMyTree({
        data: {
          sourceTreeId: treeId,
          sourceBranchId: input.item.id,
          targetTreeId: input.targetTreeId,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Branch added to your tree.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add that branch.");
    },
  });

  const growItem = useMutation({
    mutationFn: (input: { node: TreeNodePopoverSubmitInput; pendingItemId: string }) => {
      return $addCultureTreeNode({ data: { treeId, node: input.node } });
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setPendingItems((items) => items.filter((item) => item.id !== variables.pendingItemId));
        toast.error(result.limitReached.message);
        return;
      }
      toast.success("Branch grown with AI.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
      setPendingItems((items) => items.filter((item) => item.id !== variables.pendingItemId));
    },
    onError: (err: Error, variables) => {
      setPendingItems((items) => items.filter((item) => item.id !== variables.pendingItemId));
      toast.error(err.message || "Could not grow that branch.");
    },
  });

  const seedFromItem = useMutation({
    mutationFn: (input: { item: TreeItem; mediaFilter?: NodeTypeValue[]; tone: CultureTreeTone }) =>
      $seedTreeFromItem({ data: input }),
    onSuccess: async (result) => {
      setGeneratingItem(null);
      if (!result.ok) {
        toast.error(result.limitReached.message);
        return;
      }
      const nextTreeId = result.treeId;
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("New tree started.");
      void navigate({ to: "/tree/$treeId", params: { treeId: nextTreeId } });
    },
    onError: (err: Error) => {
      setGeneratingItem(null);
      toast.error(err.message || "Could not generate a new tree from that item.");
    },
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => $deleteCultureTreeNode({ data: { treeId, nodeId: itemId } }),
    onSuccess: async () => {
      toast.success("Branch removed from your tree.");
      setDeleteTarget(null);
      setCommittedTreeState(null);
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not delete that branch.");
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (input: { entityId: string; liked: boolean }) => {
      if (input.liked) {
        return $unlikeEntity({ data: { entityId: input.entityId } });
      }
      return $likeEntity({ data: { entityId: input.entityId } });
    },
    onSuccess: async (result) => {
      toast.success(result.liked ? "Liked." : "Removed from likes.");
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update like.");
    },
  });

  const visitorCta = !isOwner ? (
    <section className="rounded border border-border/60 bg-muted/20 px-4 py-6 text-center">
      <p className="font-heading text-xl tracking-tight text-foreground">Like what you see?</p>
      <p className="font-body mt-2 text-sm text-muted-foreground italic">
        Start from any album, film, book, or scene and grow a fresh line of connections.
      </p>
      <Button
        className="mt-4 font-mono text-[0.65rem] tracking-[0.06em] uppercase"
        variant="outline"
        render={<Link to="/" />}
        nativeButton={false}
      >
        Plant your own seed
      </Button>
    </section>
  ) : null;

  const previewTree = treeForVisiblePreview({
    loaderTree: tree,
    committedTree,
    pendingItems,
  });
  const pendingItemIds = pendingItems.map((item) => item.id);
  const generationIsActive = isGenerationActive(generation.status);
  const generationIsTerminal = isGenerationTerminal(generation.status);

  useEffect(() => {
    if (!generationIsActive) {
      return;
    }

    const id = window.setInterval(() => {
      void router.invalidate();
    }, 1000);
    return () => window.clearInterval(id);
  }, [generationIsActive, router]);

  const handleAddItems = async (nodes: readonly TreeNodePopoverSubmitInput[]) => {
    const nextPendingItems = nodes.map((node) => pendingTreeItemFromInput(node));
    setPendingItems((items) => [...items, ...nextPendingItems]);
    await addItem.mutateAsync({
      nodes,
      pendingItemIds: nextPendingItems.map((item) => item.id),
    });
  };

  const handleGrowItem = async (node: TreeNodePopoverSubmitInput) => {
    const pendingItem = pendingTreeItemFromInput(node);
    setPendingItems((items) => [...items, pendingItem]);
    await growItem.mutateAsync({ node, pendingItemId: pendingItem.id });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-background text-foreground">
      <div className="flex w-full flex-1 flex-col gap-7 px-4 pt-6 pb-12 sm:px-6 lg:px-8">
        <CultureTreeSeedCard
          tree={tree}
          ownerUsername={username}
          visibilityControl={
            isOwner && treeIsReady ? (
              <TreeVisibilityToggle
                isPublic={isPublic}
                isPending={setPublic.isPending}
                onChange={(next) => setPublic.mutate(next)}
              />
            ) : undefined
          }
        />
        {!treeIsReady ? (
          <ProgressiveGenerationPanel
            status={generation.status}
            stage={generation.stage}
            error={generation.error}
            branchCount={tree.items.length}
            isRetryPending={retryGeneration.isPending}
            onRetry={() => retryGeneration.mutate()}
          />
        ) : null}
        {previewTree.items.length > 0 ? (
          <TreePreview
            addToTreeTargets={addToTreeTargets}
            enrichments={enrichments}
            loadingItemIds={pendingItemIds}
            isAddItemPending={addItem.isPending}
            isAddingBranchToTree={addPublicBranch.isPending}
            isGrowItemPending={growItem.isPending}
            isGeneratingNewTree={seedFromItem.isPending}
            resolvedEntities={resolvedEntities}
            onAddItem={
              isOwner && treeIsReady
                ? async (node) => {
                    await handleAddItems(node);
                  }
                : undefined
            }
            onAddBranchToTree={
              !isOwner && viewerUserId && treeIsReady
                ? async (item, targetTreeId) => {
                    await addPublicBranch.mutateAsync({ item, targetTreeId });
                  }
                : undefined
            }
            onGrowItem={
              isOwner && treeIsReady
                ? async (node) => {
                    await handleGrowItem(node);
                  }
                : undefined
            }
            onToggleLike={async (entityId, liked) => {
              await toggleLike.mutateAsync({ entityId, liked });
            }}
            onGenerateNewTree={
              generationIsTerminal
                ? async (item) => {
                    setGeneratingItem(item);
                  }
                : undefined
            }
            onDeleteItem={isOwner && treeIsReady ? (item) => setDeleteTarget(item) : undefined}
            tree={previewTree}
          />
        ) : !treeIsReady ? (
          <LoadingBranchCards />
        ) : (
          <TreePreview
            addToTreeTargets={addToTreeTargets}
            enrichments={enrichments}
            loadingItemIds={pendingItemIds}
            isAddItemPending={addItem.isPending}
            isAddingBranchToTree={addPublicBranch.isPending}
            isGrowItemPending={growItem.isPending}
            isGeneratingNewTree={seedFromItem.isPending}
            resolvedEntities={resolvedEntities}
            onAddItem={
              isOwner && treeIsReady
                ? async (node) => {
                    await handleAddItems(node);
                  }
                : undefined
            }
            onAddBranchToTree={
              !isOwner && viewerUserId && treeIsReady
                ? async (item, targetTreeId) => {
                    await addPublicBranch.mutateAsync({ item, targetTreeId });
                  }
                : undefined
            }
            onGrowItem={
              isOwner && treeIsReady
                ? async (node) => {
                    await handleGrowItem(node);
                  }
                : undefined
            }
            onToggleLike={async (entityId, liked) => {
              await toggleLike.mutateAsync({ entityId, liked });
            }}
            onGenerateNewTree={
              generationIsTerminal
                ? async (item) => {
                    setGeneratingItem(item);
                  }
                : undefined
            }
            onDeleteItem={isOwner && treeIsReady ? (item) => setDeleteTarget(item) : undefined}
            tree={previewTree}
          />
        )}
        {visitorCta}
      </div>

      <Dialog
        open={generatingItem != null}
        onOpenChange={(open) => {
          if (!open && !seedFromItem.isPending) {
            setGeneratingItem(null);
          }
        }}
      >
        <DialogContent showCloseButton={!seedFromItem.isPending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {seedFromItem.isPending ? "Exploring" : "Explore This"}
            </DialogTitle>
            <DialogDescription className="font-body text-base leading-relaxed">
              {generatingItem ? (
                <>
                  Build a fresh guide-shaped Culture Tree from{" "}
                  <span className="text-foreground">{generatingItem.name}</span>.
                </>
              ) : (
                "Build a fresh guide-shaped Culture Tree from this Branch."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <CulturalMixSelector
              selectedTypes={selectedGenerationTypes}
              disabled={seedFromItem.isPending}
              onSelectedTypesChange={setSelectedGenerationTypes}
            />
            <CultureTreeToneSelector
              value={generationTone}
              disabled={seedFromItem.isPending}
              onValueChange={setGenerationTone}
            />

            {seedFromItem.isPending ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                <LoaderCircleIcon
                  className="size-5 shrink-0 animate-spin text-primary"
                  aria-hidden
                />
                <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                  Exploring…
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="amber"
                className="w-full rounded-sm font-mono text-[0.65rem] tracking-[0.08em] uppercase"
                onClick={() => {
                  if (!generatingItem) {
                    return;
                  }
                  seedFromItem.mutate({
                    item: generatingItem,
                    tone: generationTone,
                    mediaFilter: mediaFilterFromSelectedNodeTypes(selectedGenerationTypes),
                  });
                }}
              >
                Explore This
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteTreeNodeDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        branchLabel={deleteTarget?.name ?? ""}
        isPending={deleteItem.isPending}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          deleteItem.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
