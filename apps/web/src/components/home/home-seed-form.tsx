import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { NodeTypeValue, TreeRequest } from "@repo/schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  CultureTreeToneSelector,
  type CultureTreeTone,
} from "~/components/culture-tree-tone-selector";
import {
  CULTURE_TREE_NODE_TYPES,
  CulturalMixSelector,
  mediaFilterFromSelectedNodeTypes,
} from "~/components/node-type-filter-list";
import { useOpenSignIn } from "~/components/sign-in-dialog-host";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";
import { $generateCultureTree, $startTreeFromScratch } from "~/server/generate-culture-tree";

function SeedCountLine() {
  const { data } = useQuery(myCultureTreesQueryOptions());
  const n = data?.count ?? 0;
  return (
    <p className="text-center font-mono text-[0.7rem] text-muted-foreground">
      {n === 0
        ? "No trees yet. Start with a Seed or build one by hand."
        : `${n} culture tree${n === 1 ? "" : "s"} started`}
    </p>
  );
}

export function HomeSeedForm({
  prompt,
  setPrompt,
  onSeedHover,
  variant = "hero",
  onCreated,
}: {
  readonly prompt: string;
  readonly setPrompt: (value: string) => void;
  readonly onSeedHover?: (hovered: boolean) => void;
  /** "hero" is the large homepage form; "compact" is a condensed variant for dialogs. */
  readonly variant?: "hero" | "compact";
  /** Called after a tree is created or generation starts (e.g. to close a dialog). */
  readonly onCreated?: () => void;
}) {
  const { openSignIn } = useOpenSignIn();
  const { data: user } = useQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const depth: TreeRequest["depth"] = "standard";
  const [tone, setTone] = useState<CultureTreeTone>("mixed");
  const [selectedTypes, setSelectedTypes] = useState<NodeTypeValue[]>([...CULTURE_TREE_NODE_TYPES]);
  const [generateOptionsOpen, setGenerateOptionsOpen] = useState(false);
  const [treeNameError, setTreeNameError] = useState(false);
  const loggedIn = Boolean(user);
  const treeName = prompt.trim();

  const generate = useMutation({
    mutationFn: async () => {
      const query = prompt.trim();
      if (!query) {
        throw new Error("Enter a Seed first.");
      }
      return $generateCultureTree({
        data: {
          query,
          depth,
          tone,
          mediaFilter: mediaFilterFromSelectedNodeTypes(selectedTypes),
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.limitReached.message);
        return;
      }
      const { treeId } = result;
      setGenerateOptionsOpen(false);
      onCreated?.();
      void queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("Your AI-assisted Culture Tree is growing.");
      void navigate({ to: "/tree/$treeId", params: { treeId } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not generate tree.");
    },
  });

  const startFromScratch = useMutation({
    mutationFn: async () => {
      const title = prompt.trim();
      if (!title) {
        throw new Error("Name the tree first.");
      }
      return $startTreeFromScratch({
        data: {
          title,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.limitReached.message);
        return;
      }
      const { treeId } = result;
      onCreated?.();
      void queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("Your Culture Tree is ready to curate.");
      void navigate({ to: "/tree/$treeId", params: { treeId } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not create that tree.");
    },
  });
  const creationPending = generate.isPending || startFromScratch.isPending;

  const requireTreeName = () => {
    if (treeName) {
      return true;
    }
    setTreeNameError(true);
    return false;
  };

  const openGenerateOptions = () => {
    if (!requireTreeName() || creationPending) {
      return;
    }
    if (!loggedIn) {
      openSignIn();
      return;
    }
    setGenerateOptionsOpen(true);
  };

  const compact = variant === "compact";
  const inputId = compact ? "generate-tree-seed-compact" : "generate-tree-seed";
  const errorId = compact ? "tree-name-error-compact" : "tree-name-error";

  const handleStartFromScratch = () => {
    if (!requireTreeName()) {
      return;
    }
    if (!loggedIn) {
      openSignIn();
      return;
    }
    if (startFromScratch.isPending) return;
    startFromScratch.mutate();
  };

  return (
    <section
      className={cn(
        "relative z-10 w-full",
        compact ? "space-y-4" : "mx-auto max-w-4xl space-y-6 px-4 sm:px-6 md:px-0",
      )}
    >
      <form
        className={compact ? "space-y-4" : "space-y-7"}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!requireTreeName() || creationPending) return;
          openGenerateOptions();
        }}
      >
        {compact ? (
          <div className="space-y-4">
            <div className="relative rounded-lg border border-border/70 bg-card/35 p-3 transition-colors focus-within:border-primary/70">
              <label htmlFor={inputId} className="sr-only">
                Culture Tree name or Seed
              </label>
              <input
                id={inputId}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (e.target.value.trim()) {
                    setTreeNameError(false);
                  }
                }}
                placeholder="A film, album, book, scene, artist..."
                maxLength={200}
                autoFocus
                aria-invalid={treeNameError}
                aria-describedby={treeNameError ? errorId : undefined}
                className={cn(
                  "font-heading w-full bg-transparent text-xl text-foreground italic outline-none",
                  "placeholder:text-muted-foreground/65",
                  "caret-primary",
                )}
              />
            </div>
            <p
              id={errorId}
              className={cn(
                "font-mono text-[0.65rem] tracking-[0.08em] text-destructive uppercase",
                !treeNameError && "invisible",
              )}
            >
              Tree name is required
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={creationPending}
                onClick={handleStartFromScratch}
                className={cn(
                  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border px-4 py-2.5 font-mono text-xs tracking-[0.12em] uppercase transition-colors",
                  treeName
                    ? "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
                    : "border-border/70 bg-card/50 text-muted-foreground",
                )}
              >
                {startFromScratch.isPending ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <PlusIcon className="size-3.5" aria-hidden />
                    Create Tree
                  </>
                )}
              </button>
              <button
                type="button"
                aria-label="Generate Tree with AI"
                disabled={creationPending}
                onMouseEnter={() => onSeedHover?.(true)}
                onMouseLeave={() => onSeedHover?.(false)}
                onClick={openGenerateOptions}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 py-2.5 font-mono text-xs tracking-[0.12em] uppercase transition-colors",
                  treeName
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-primary/70 bg-primary text-primary-foreground opacity-65 hover:opacity-80",
                )}
              >
                {generate.isPending ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <SparklesIcon className="size-3.5" aria-hidden />
                )}
                Generate with AI
              </button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-lg border border-border/70 bg-card/35 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition-colors focus-within:border-primary/70 sm:p-6">
            <label htmlFor={inputId} className="sr-only">
              Culture Tree name or Seed
            </label>
            <input
              id={inputId}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (e.target.value.trim()) {
                  setTreeNameError(false);
                }
              }}
              placeholder="A film, album, book, scene, artist..."
              maxLength={200}
              aria-invalid={treeNameError}
              aria-describedby={treeNameError ? errorId : undefined}
              className={cn(
                "font-heading w-full bg-transparent text-3xl text-foreground italic outline-none sm:text-4xl",
                "pr-0 pb-24 sm:pr-72 sm:pb-0",
                "placeholder:text-muted-foreground/65",
                "caret-primary",
              )}
            />
            <p
              id={errorId}
              className={cn(
                "absolute right-4 bottom-[4.75rem] rounded-sm border border-destructive/25 bg-background/95 px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-destructive uppercase shadow-sm sm:right-6 sm:bottom-[calc(50%+2rem)]",
                !treeNameError && "invisible",
              )}
            >
              Tree name is required
            </p>
            <div className="absolute right-4 bottom-4 flex max-w-[calc(100%-2rem)] flex-wrap justify-end gap-2 sm:right-6 sm:bottom-1/2 sm:translate-y-1/2">
              <button
                type="button"
                disabled={creationPending}
                onClick={handleStartFromScratch}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border px-5 py-3 font-mono text-xs tracking-[0.12em] uppercase transition-colors",
                  treeName
                    ? "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
                    : "border-border/70 bg-card/50 text-muted-foreground",
                )}
              >
                {startFromScratch.isPending ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <PlusIcon className="size-3.5" aria-hidden />
                    Create Tree
                  </>
                )}
              </button>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Generate Tree with AI"
                      disabled={creationPending}
                      onMouseEnter={() => onSeedHover?.(true)}
                      onMouseLeave={() => onSeedHover?.(false)}
                      onClick={openGenerateOptions}
                      className={cn(
                        "inline-flex min-h-12 min-w-12 items-center justify-center rounded-sm border p-3 transition-colors",
                        treeName
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-primary/70 bg-primary text-primary-foreground opacity-65 hover:opacity-80",
                      )}
                    />
                  }
                >
                  {generate.isPending ? (
                    <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <SparklesIcon className="size-4" aria-hidden />
                  )}
                </TooltipTrigger>
                <TooltipContent>Generate Tree with AI</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {loggedIn && !compact ? <SeedCountLine /> : null}
      </form>

      <Dialog
        open={generateOptionsOpen}
        onOpenChange={(open) => {
          if (!open && !generate.isPending) {
            setGenerateOptionsOpen(false);
          }
        }}
      >
        <DialogContent showCloseButton={!generate.isPending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {generate.isPending ? "Generating" : "Generate Tree"}
            </DialogTitle>
            <DialogDescription className="font-body text-base leading-relaxed">
              Start an AI-assisted Culture Tree from{" "}
              <span className="text-foreground">{prompt.trim() || "this Seed"}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <CulturalMixSelector
              selectedTypes={selectedTypes}
              disabled={generate.isPending}
              onSelectedTypesChange={setSelectedTypes}
            />
            <CultureTreeToneSelector
              value={tone}
              disabled={generate.isPending}
              onValueChange={setTone}
            />

            {generate.isPending ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                <LoaderCircleIcon
                  className="size-5 shrink-0 animate-spin text-primary"
                  aria-hidden
                />
                <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                  Generating
                </p>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-primary bg-primary px-5 py-3 font-mono text-xs tracking-[0.12em] text-primary-foreground uppercase transition-colors hover:bg-primary/90",
                )}
                onClick={() => generate.mutate()}
              >
                <SparklesIcon className="size-3.5" aria-hidden />
                Generate Tree
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
