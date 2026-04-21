import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { TreeNode } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteTreeNodeDialog } from "~/components/delete-tree-node-dialog";
import { TreeFlowView } from "~/components/tree-flow-view";
import { TreeNodeDrawer, type TreeNodeDrawerSubmitInput } from "~/components/tree-node-drawer";
import { TreePreview } from "~/components/tree-preview";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { useMinMd } from "~/lib/use-min-md";
import {
  $addCultureTreeNode,
  $deleteCultureTreeNode,
  $getCultureTreeById,
  $setCultureTreePublic,
} from "~/server/culture-trees";
import { $enrichExistingCultureTree } from "~/server/enrich-culture-tree";

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
      enrichments: row.enrichments,
      isOwner: user?.id === row.userId,
      isPublic: row.isPublic,
    };
  },
  component: TreePage,
});

function TreePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tree, enrichments, isOwner, treeId, isPublic } = Route.useLoaderData();
  const isWide = useMinMd();
  const [view, setView] = useState<"list" | "flow">("list");
  const [mounted, setMounted] = useState(false);
  const [draftTarget, setDraftTarget] = useState<{
    parentNodeId: string;
    parentLabel: string;
    parentType?: import("@repo/schemas").NodeTypeValue;
    parentImageSrc?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    nodeId: string;
    nodeLabel: string;
    subtreeNodeCount: number;
  } | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const effectiveView = isWide && view === "flow" ? "flow" : "list";

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

  const addNode = useMutation({
    mutationFn: (input: { parentNodeId: string; node: TreeNodeDrawerSubmitInput }) => {
      const { parentNodeId, node } = input;
      return $addCultureTreeNode({ data: { treeId, parentNodeId, node } });
    },
    onSuccess: async () => {
      toast.success("Branch added to your tree.");
      setDraftTarget(null);
      await queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      await router.invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add that branch.");
    },
  });

  const deleteNode = useMutation({
    mutationFn: (nodeId: string) => $deleteCultureTreeNode({ data: { treeId, nodeId } }),
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

  const openRootDrawer = useCallback(() => {
    setDraftTarget({
      parentNodeId: "root",
      parentLabel: tree.searchHint.title || tree.name,
    });
  }, [tree.name, tree.searchHint.title]);

  const openChildDrawer = useCallback(
    (nodeId: string, node: TreeNode) => {
      const media = enrichments[nodeId];
      setDraftTarget({
        parentNodeId: nodeId,
        parentLabel: node.name,
        parentType: node.type,
        parentImageSrc: media?.coverUrl ?? media?.thumbnailUrl ?? node.snapshot?.image,
      });
    },
    [enrichments],
  );

  const openDeleteDialog = useCallback((nodeId: string, node: TreeNode) => {
    const countSubtreeNodes = (target: TreeNode): number =>
      1 + target.children.reduce((sum, child) => sum + countSubtreeNodes(child), 0);

    setDeleteTarget({
      nodeId,
      nodeLabel: node.name,
      subtreeNodeCount: countSubtreeNodes(node),
    });
  }, []);

  const viewToggle = isWide ? (
    <div className="inline-flex shrink-0 gap-px" role="group" aria-label="How to display this tree">
      <button
        type="button"
        aria-pressed={view === "list"}
        className={cn(
          "border px-3 py-1.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase transition-colors",
          "rounded-l-sm",
          view === "list"
            ? "border-border/80 bg-foreground/10 text-foreground"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setView("list")}
      >
        List
      </button>
      <button
        type="button"
        aria-pressed={view === "flow"}
        className={cn(
          "border px-3 py-1.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase transition-colors",
          "-ml-px rounded-r-sm",
          view === "flow"
            ? "border-border/80 bg-foreground/10 text-foreground"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setView("flow")}
      >
        Flow
      </button>
    </div>
  ) : null;

  const visitorCta = !isOwner ? (
    <section className="rounded border border-border/60 bg-muted/20 px-4 py-6 text-center">
      <p className="font-heading text-xl tracking-tight text-foreground">Like what you see?</p>
      <p className="font-body mt-2 text-sm text-muted-foreground italic">
        Start from any album, film, book, or scene — get a branching map in minutes.
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
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          disabled={setPublic.isPending}
          onClick={() => setPublic.mutate(!isPublic)}
          className={cn(
            "inline-flex items-center rounded-sm border px-3 py-1 font-mono text-[0.6rem] tracking-[0.06em] uppercase transition-colors",
            isPublic
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground",
            setPublic.isPending && "opacity-60",
          )}
        >
          {setPublic.isPending ? "…" : isPublic ? "Public" : "Private"}
        </button>
        {viewToggle}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-foreground">
      <div className="shrink-0 bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {ownerToolbar}
          {!isOwner && viewToggle ? <div className="flex justify-end">{viewToggle}</div> : null}
        </div>
      </div>

      {effectiveView === "flow" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {mounted ? (
            <TreeFlowView
              enrichments={enrichments}
              onAddBranch={isOwner ? openRootDrawer : undefined}
              onAddChild={isOwner ? openChildDrawer : undefined}
              onDeleteNode={isOwner ? openDeleteDialog : undefined}
              tree={tree}
              treeKey={treeId}
            />
          ) : null}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
          <TreePreview
            enrichments={enrichments}
            onAddBranch={isOwner ? openRootDrawer : undefined}
            onAddChild={isOwner ? openChildDrawer : undefined}
            onDeleteNode={isOwner ? openDeleteDialog : undefined}
            tree={tree}
          />
          {visitorCta}
        </div>
      )}

      {effectiveView === "flow" && visitorCta ? (
        <div className="shrink-0 border-t border-border/60 px-4 py-6">{visitorCta}</div>
      ) : null}

      <TreeNodeDrawer
        open={draftTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDraftTarget(null);
          }
        }}
        parentLabel={draftTarget?.parentLabel ?? tree.name}
        parentNodeId={draftTarget?.parentNodeId ?? "root"}
        parentType={draftTarget?.parentType}
        parentImageSrc={draftTarget?.parentImageSrc}
        isPending={addNode.isPending}
        onSubmit={(input) => {
          if (!draftTarget) {
            return;
          }
          addNode.mutate({
            parentNodeId: draftTarget.parentNodeId,
            node: input,
          });
        }}
      />

      <DeleteTreeNodeDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        branchLabel={deleteTarget?.nodeLabel ?? ""}
        subtreeNodeCount={deleteTarget?.subtreeNodeCount ?? 1}
        isPending={deleteNode.isPending}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          deleteNode.mutate(deleteTarget.nodeId);
        }}
      />
    </div>
  );
}
