import type { NodeTypeValue } from "@repo/schemas";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LoaderCircleIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState, type ReactElement } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { treeMembershipQueryOptions } from "~/lib/tree-membership-query";

export type AddToTreeTarget = {
  readonly id: string;
  readonly title: string;
  readonly isPublic: boolean;
  readonly branchCount: number;
  readonly previewType?: NodeTypeValue;
  readonly previewImageUrl?: string;
};

/**
 * "Save to tree" panel: lists the viewer's own trees with a checkmark on the
 * ones that already contain this branch (add-only — members are disabled), and
 * adds the branch to a chosen tree on click.
 */
export function AddToTreePopover({
  sourceTreeId,
  itemId,
  targets,
  onAddToTree,
  onStartNewTree,
  trigger,
}: {
  readonly sourceTreeId: string;
  readonly itemId: string;
  readonly targets: readonly AddToTreeTarget[];
  readonly onAddToTree: (targetTreeId: string) => Promise<void>;
  readonly onStartNewTree?: () => Promise<void>;
  readonly trigger: ReactElement;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addingTreeId, setAddingTreeId] = useState<string | null>(null);
  const [isStartingNewTree, setIsStartingNewTree] = useState(false);

  const membershipOptions = treeMembershipQueryOptions({ sourceTreeId, sourceBranchId: itemId });
  const membership = useQuery({ ...membershipOptions, enabled: open });
  const memberIds = new Set(membership.data?.treeIds ?? []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? targets.filter((target) => target.title.toLowerCase().includes(normalizedQuery))
    : targets;

  const handleStartNewTree = async () => {
    if (!onStartNewTree) {
      return;
    }
    setIsStartingNewTree(true);
    try {
      await onStartNewTree();
      setOpen(false);
    } finally {
      setIsStartingNewTree(false);
    }
  };

  const handleAdd = async (targetTreeId: string) => {
    setAddingTreeId(targetTreeId);
    try {
      await onAddToTree(targetTreeId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: membershipOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey }),
      ]);
    } finally {
      setAddingTreeId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" side="top" className="w-80 gap-3 p-3">
        <div className="relative">
          <SearchIcon
            className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your trees…"
            className="h-9 rounded-full pl-8 text-sm placeholder:text-sm"
          />
        </div>
        {onStartNewTree ? (
          <button
            type="button"
            disabled={isStartingNewTree}
            onClick={() => void handleStartNewTree()}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent",
              isStartingNewTree && "opacity-70",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <PlusIcon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                Start a new tree
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Seed a fresh tree with this branch
              </span>
            </span>
            <span className="flex size-6 shrink-0 items-center justify-center">
              {isStartingNewTree ? (
                <LoaderCircleIcon
                  className="size-4 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </span>
          </button>
        ) : null}
        <p className="px-1 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
          Your trees
        </p>
        <div className="-mr-1 max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {targets.length === 0 ? "No other trees yet." : "No trees match that search."}
            </p>
          ) : (
            filtered.map((target) => {
              const isMember = memberIds.has(target.id);
              const isAdding = addingTreeId === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={isMember || isAdding || membership.isLoading}
                  onClick={() => void handleAdd(target.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                    isMember ? "cursor-default" : "hover:bg-accent",
                    isAdding && "opacity-70",
                  )}
                >
                  <NodeThumbnail
                    type={target.previewType ?? "album"}
                    src={target.previewImageUrl}
                    size="sm"
                    className="size-9 shrink-0 rounded-md object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground capitalize">
                      {target.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {target.branchCount} {target.branchCount === 1 ? "branch" : "branches"} ·{" "}
                      {target.isPublic ? "Public" : "Private"}
                    </span>
                  </span>
                  <span className="flex size-6 shrink-0 items-center justify-center">
                    {isAdding ? (
                      <LoaderCircleIcon
                        className="size-4 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    ) : isMember ? (
                      <CheckIcon className="size-4 text-primary" aria-hidden />
                    ) : (
                      <PlusIcon className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
