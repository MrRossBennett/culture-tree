import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { TreePreview } from "~/components/tree-preview";
import { $getCultureTreeById } from "~/server/culture-trees";
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
    };
  },
  component: TreePage,
});

function TreePage() {
  const router = useRouter();
  const { tree, enrichments, isOwner, treeId } = Route.useLoaderData();

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 text-foreground">
      <div className="flex flex-wrap items-center justify-end gap-4">
        {!isOwner ? (
          <Button render={<Link to="/" />} variant="secondary" nativeButton={false}>
            Plant your own seed
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enrich.isPending}
              onClick={() => enrich.mutate()}
              className="inline-flex items-center gap-2 font-mono text-xs"
            >
              {enrich.isPending ? (
                <LoaderCircleIcon className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : null}
              {enrich.isPending ? "Enriching…" : "Enrich media"}
            </Button>
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              Your tree ·{" "}
              <span className="text-foreground select-all" title="Share this URL">
                /tree/{treeId}
              </span>
            </span>
          </div>
        )}
      </div>
      <TreePreview enrichments={enrichments} tree={tree} />
    </div>
  );
}
