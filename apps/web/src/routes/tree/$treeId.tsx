import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { CultureTree, NodeTypeValue, TreeItem } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { ButtonGroup } from "@repo/ui/components/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { LoaderCircleIcon, SproutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DeleteTreeNodeDialog } from "~/components/delete-tree-node-dialog";
import {
  CULTURE_TREE_NODE_TYPES,
  NodeTypeFilterList,
  mediaFilterFromSelectedNodeTypes,
} from "~/components/node-type-filter-list";
import { TreeNodeDrawer, type TreeNodePopoverSubmitInput } from "~/components/tree-node-popover";
import { TreePreview } from "~/components/tree-preview";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import {
  $addCultureTreeNode,
  $deleteCultureTreeNode,
  $getCultureTreeById,
  $setCultureTreePublic,
} from "~/server/culture-trees";
import { $enrichExistingCultureTree } from "~/server/enrich-culture-tree";
import { $likeEntity, $unlikeEntity } from "~/server/entity-resolver";
import { $seedTreeFromItem } from "~/server/generate-culture-tree";

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
      isPublic: row.isPublic,
    };
  },
  component: TreePage,
});

function CultureTreeSeedCard({
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
    <section className="relative mx-auto w-full max-w-3xl">
      <div className="rounded-[1.4rem] border border-primary/20 bg-card/92 px-3 py-2 shadow-[0_14px_38px_-34px_rgba(120,78,18,0.36)] sm:px-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
            <SproutIcon className="size-4 shrink-0 translate-y-0.5 text-primary" aria-hidden />
            <h1 className="font-heading min-w-0 truncate text-2xl leading-tight tracking-tight text-card-foreground md:text-3xl">
              {tree.seed}
            </h1>
            {byline ? (
              <p className="font-body shrink-0 text-sm text-muted-foreground italic md:text-base">
                {byline}
              </p>
            ) : null}
          </div>
          {onAddItem ? (
            <div className="shrink-0">
              <TreeNodeDrawer
                triggerLabel="Grow new branch"
                triggerClassName="text-[0.65rem]"
                isPending={isAddItemPending}
                onSubmit={(node) => onAddItem("root", node)}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="mx-auto mt-2 h-5 w-px bg-gradient-to-b from-primary/35 to-transparent" />
    </section>
  );
}

function pendingTreeItemFromInput(input: TreeNodePopoverSubmitInput): TreeItem {
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
  const { tree, username, enrichments, resolvedEntities, isOwner, treeId, isPublic } =
    Route.useLoaderData();
  const [generatingItem, setGeneratingItem] = useState<TreeItem | null>(null);
  const [selectedGenerationTypes, setSelectedGenerationTypes] = useState<NodeTypeValue[]>([
    ...CULTURE_TREE_NODE_TYPES,
  ]);
  const [deleteTarget, setDeleteTarget] = useState<TreeItem | null>(null);
  const [pendingItems, setPendingItems] = useState<TreeItem[]>([]);

  const enrich = useMutation({
    mutationFn: () => $enrichExistingCultureTree({ data: { treeId } }),
    onSuccess: async () => {
      toast.success("Media and links updated.");
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not enrich this tree.");
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
      parentItemId: string;
      node: TreeNodePopoverSubmitInput;
      pendingItemId: string;
    }) => {
      const { parentItemId, node } = input;
      return $addCultureTreeNode({ data: { treeId, parentNodeId: parentItemId, node } });
    },
    onSuccess: async (_, variables) => {
      toast.success("Branch added to your tree.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
      setPendingItems((items) => items.filter((item) => item.id !== variables.pendingItemId));
    },
    onError: (err: Error, variables) => {
      setPendingItems((items) => items.filter((item) => item.id !== variables.pendingItemId));
      toast.error(err.message || "Could not add that branch.");
    },
  });

  const seedFromItem = useMutation({
    mutationFn: (input: { item: TreeItem; mediaFilter?: NodeTypeValue[] }) =>
      $seedTreeFromItem({ data: input }),
    onSuccess: async ({ treeId: nextTreeId }) => {
      setGeneratingItem(null);
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("New tree generated.");
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

  const ownerToolbar = isOwner ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={enrich.isPending}
        onClick={() => enrich.mutate()}
        className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase hover:text-foreground"
      >
        {enrich.isPending ? (
          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : null}
        {enrich.isPending ? "Enriching…" : "Dev: Enrich media"}
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.6rem] tracking-wide text-muted-foreground/60 uppercase">
          Link
        </span>
        <ButtonGroup aria-label="Tree link visibility" className="rounded">
          <Button
            type="button"
            size="xs"
            variant={isPublic ? "outline" : "default"}
            aria-pressed={!isPublic}
            disabled={setPublic.isPending}
            onClick={() => {
              if (!isPublic) {
                return;
              }
              setPublic.mutate(false);
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
            disabled={setPublic.isPending}
            onClick={() => {
              if (isPublic) {
                return;
              }
              setPublic.mutate(true);
            }}
            className="font-mono text-[0.6rem] tracking-[0.06em] uppercase"
          >
            Public
          </Button>
        </ButtonGroup>
      </div>
    </div>
  ) : null;

  const previewTree =
    pendingItems.length > 0 ? { ...tree, items: [...tree.items, ...pendingItems] } : tree;
  const pendingItemIds = pendingItems.map((item) => item.id);
  const allGenerationTypesSelected =
    selectedGenerationTypes.length === CULTURE_TREE_NODE_TYPES.length;

  const handleAddItem = async (parentItemId: string, node: TreeNodePopoverSubmitInput) => {
    const pendingItem = pendingTreeItemFromInput(node);
    setPendingItems((items) => [...items, pendingItem]);
    await addItem.mutateAsync({ parentItemId, node, pendingItemId: pendingItem.id });
  };

  const toggleGenerationType = (type: NodeTypeValue) => {
    setSelectedGenerationTypes((current) => {
      if (current.length === CULTURE_TREE_NODE_TYPES.length) {
        return [type];
      }

      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-foreground">
      <div className="shrink-0 bg-background px-4 py-3">
        <div className="mx-auto max-w-6xl">{ownerToolbar}</div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-4 px-4 pb-10">
        <CultureTreeSeedCard
          tree={tree}
          ownerUsername={username}
          isAddItemPending={addItem.isPending}
          onAddItem={async (parentItemId, node) => {
            await handleAddItem(parentItemId, node);
          }}
        />
        <TreePreview
          enrichments={enrichments}
          loadingItemIds={pendingItemIds}
          isGeneratingNewTree={seedFromItem.isPending}
          resolvedEntities={resolvedEntities}
          onToggleLike={async (entityId, liked) => {
            await toggleLike.mutateAsync({ entityId, liked });
          }}
          onGenerateNewTree={async (item) => {
            setGeneratingItem(item);
          }}
          onDeleteItem={isOwner ? (item) => setDeleteTarget(item) : undefined}
          tree={previewTree}
        />
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
              {seedFromItem.isPending ? "Generating new tree" : "Generate new tree"}
            </DialogTitle>
            <DialogDescription className="font-body text-base leading-relaxed">
              {generatingItem ? (
                <>
                  Build a fresh tree from{" "}
                  <span className="text-foreground">{generatingItem.name}</span>.
                </>
              ) : (
                "Build a fresh tree from this item."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                Cultural mix
              </p>
              <NodeTypeFilterList
                selectedTypes={selectedGenerationTypes}
                allSelected={allGenerationTypesSelected}
                disabled={seedFromItem.isPending}
                onSelectAll={() => setSelectedGenerationTypes([...CULTURE_TREE_NODE_TYPES])}
                onToggleType={toggleGenerationType}
              />
            </div>

            {seedFromItem.isPending ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                <LoaderCircleIcon
                  className="size-5 shrink-0 animate-spin text-primary"
                  aria-hidden
                />
                <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                  Generating connections…
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
                    mediaFilter: mediaFilterFromSelectedNodeTypes(selectedGenerationTypes),
                  });
                }}
              >
                Generate tree
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
        subtreeNodeCount={1}
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
