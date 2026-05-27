import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { NodeTypeValue, TreeRequest } from "@repo/schemas";
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
}: {
  readonly prompt: string;
  readonly setPrompt: (value: string) => void;
  readonly onSeedHover?: (hovered: boolean) => void;
}) {
  const { openSignIn } = useOpenSignIn();
  const { data: user } = useQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const depth: TreeRequest["depth"] = "standard";
  const [tone, setTone] = useState<CultureTreeTone>("mixed");
  const [selectedTypes, setSelectedTypes] = useState<NodeTypeValue[]>([...CULTURE_TREE_NODE_TYPES]);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const loggedIn = Boolean(user);

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
      const title = manualTitle.trim();
      if (!title) {
        throw new Error("Name the tree first.");
      }
      return $startTreeFromScratch({
        data: {
          title,
          description: manualDescription.trim() || undefined,
        },
      });
    },
    onSuccess: (result) => {
      const { treeId } = result;
      setManualTitle("");
      setManualDescription("");
      void queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("Your Culture Tree is ready to curate.");
      void navigate({ to: "/tree/$treeId", params: { treeId } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not start that tree.");
    },
  });

  return (
    <section className="relative z-10 mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6 md:px-0">
      <form
        className="space-y-7"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!loggedIn) {
            openSignIn();
            return;
          }
          if (!prompt.trim() || generate.isPending) return;
          generate.mutate();
        }}
      >
        <div className="relative rounded-lg border border-border/70 bg-card/35 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition-colors focus-within:border-primary/70 sm:p-6">
          <label
            htmlFor="generate-tree-seed"
            className="mb-3 block font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase"
          >
            Generate Tree with AI
          </label>
          <input
            id="generate-tree-seed"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a Seed: album, film, book, era..."
            maxLength={200}
            className={cn(
              "font-heading w-full bg-transparent text-3xl text-foreground italic outline-none sm:text-4xl",
              "pr-0 pb-18 sm:pr-52 sm:pb-0",
              "placeholder:text-muted-foreground/65",
              "caret-primary",
            )}
          />
          <button
            type="submit"
            disabled={generate.isPending}
            onMouseEnter={() => onSeedHover?.(true)}
            onMouseLeave={() => onSeedHover?.(false)}
            className={cn(
              "absolute right-4 bottom-4 inline-flex min-h-12 items-center justify-center font-mono text-xs tracking-[0.12em] uppercase transition-colors sm:right-6 sm:bottom-1/2 sm:translate-y-1/2",
              "gap-2 rounded-sm border px-6 py-3",
              prompt.trim()
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-primary/70 bg-primary text-primary-foreground opacity-65 hover:opacity-80",
            )}
          >
            {generate.isPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <>
                <SparklesIcon className="size-3.5" aria-hidden />
                Generate Tree
              </>
            )}
          </button>
        </div>

        <CulturalMixSelector
          selectedTypes={selectedTypes}
          disabled={generate.isPending}
          size="lg"
          label="From"
          inlineLabel
          visibleTypeCount={6}
          className="overflow-x-auto pb-1"
          onSelectedTypesChange={setSelectedTypes}
        />

        <CultureTreeToneSelector
          value={tone}
          disabled={generate.isPending}
          label="Tone"
          inlineLabel
          onValueChange={setTone}
        />

        {loggedIn ? <SeedCountLine /> : null}
      </form>

      <form
        className="border-t border-border/55 pt-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!loggedIn) {
            openSignIn();
            return;
          }
          if (!manualTitle.trim() || startFromScratch.isPending) return;
          startFromScratch.mutate();
        }}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="grid gap-2">
            <label
              htmlFor="manual-tree-title"
              className="font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase"
            >
              Build from scratch
            </label>
            <input
              id="manual-tree-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Name a Culture Tree you want to curate"
              maxLength={140}
              className={cn(
                "h-11 rounded-sm border border-border/70 bg-card/55 px-3 text-sm text-foreground transition-colors outline-none",
                "placeholder:text-muted-foreground/65 focus:border-primary/70",
              )}
            />
            <input
              aria-label="Optional tree description"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={500}
              className={cn(
                "h-10 rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-foreground transition-colors outline-none",
                "placeholder:text-muted-foreground/60 focus:border-primary/60",
              )}
            />
          </div>
          <button
            type="submit"
            disabled={startFromScratch.isPending}
            className={cn(
              "inline-flex h-11 items-center justify-center rounded-sm border px-5 font-mono text-[0.65rem] tracking-[0.1em] uppercase transition-colors",
              "gap-2",
              manualTitle.trim()
                ? "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
                : "border-border/70 bg-card/50 text-muted-foreground",
            )}
          >
            {startFromScratch.isPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <>
                <PlusIcon className="size-3.5" aria-hidden />
                Start Tree
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
