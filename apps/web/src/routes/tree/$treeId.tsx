import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { TreeItem } from "@repo/schemas";
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
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DeleteTreeNodeDialog } from "~/components/delete-tree-node-dialog";
import { type TreeNodePopoverSubmitInput } from "~/components/tree-node-popover";
import { TreePreview } from "~/components/tree-preview";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import {
  $addCultureTreeNode,
  $deleteCultureTreeNode,
  $getCultureTreeById,
  $setCultureTreePublic,
} from "~/server/culture-trees";
import { $enrichExistingCultureTree } from "~/server/enrich-culture-tree";
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
      isOwner: user?.id === row.userId,
      isPublic: row.isPublic,
    };
  },
  component: TreePage,
});

function TreePage() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tree, username, enrichments, isOwner, treeId, isPublic } = Route.useLoaderData();
  const [generatingItem, setGeneratingItem] = useState<TreeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreeItem | null>(null);

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
    mutationFn: (input: { parentItemId: string; node: TreeNodePopoverSubmitInput }) => {
      const { parentItemId, node } = input;
      return $addCultureTreeNode({ data: { treeId, parentNodeId: parentItemId, node } });
    },
    onSuccess: async () => {
      toast.success("Branch added to your tree.");
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add that branch.");
    },
  });

  const seedFromItem = useMutation({
    mutationFn: (item: TreeItem) => $seedTreeFromItem({ data: { item } }),
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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-foreground">
      <div className="shrink-0 bg-background px-4 py-3">
        <div className="mx-auto max-w-6xl">{ownerToolbar}</div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-10 px-4 pb-10">
        <TreePreview
          enrichments={enrichments}
          isAddItemPending={addItem.isPending}
          isGeneratingNewTree={seedFromItem.isPending}
          ownerUsername={username}
          onAddItem={async (parentItemId, node) => {
            await addItem.mutateAsync({ parentItemId, node });
          }}
          onGenerateNewTree={async (item) => {
            setGeneratingItem(item);
            await seedFromItem.mutateAsync(item);
          }}
          onDeleteItem={isOwner ? (item) => setDeleteTarget(item) : undefined}
          tree={tree}
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
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Generating new tree</DialogTitle>
            <DialogDescription className="font-body text-base leading-relaxed">
              {generatingItem ? (
                <>
                  Building a fresh tree from{" "}
                  <span className="text-foreground">{generatingItem.name}</span>. This dialog will
                  close automatically when the new tree is ready.
                </>
              ) : (
                "Building a fresh tree from this item."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <LoaderCircleIcon className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
            <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
              Generating connections…
            </p>
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
