import { authQueryOptions } from "@repo/auth/tanstack/queries";
import type { NodeTypeValue, TreeRequest } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
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
import { $generateCultureTree } from "~/server/generate-culture-tree";

function SeedCountLine() {
  const { data } = useQuery(myCultureTreesQueryOptions());
  const n = data?.count ?? 0;
  return (
    <p className="text-center font-mono text-[0.7rem] text-muted-foreground">
      {n === 0
        ? "No seeds planted yet — your first tree starts above."
        : `${n} seed${n === 1 ? "" : "s"} planted`}
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
  const loggedIn = Boolean(user);

  const generate = useMutation({
    mutationFn: async () => {
      const query = prompt.trim();
      if (!query) {
        throw new Error("Enter a seed first.");
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
      toast.success("Your culture tree is growing.");
      void navigate({ to: "/tree/$treeId", params: { treeId } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not generate tree.");
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
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter an album, film, book, era..."
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
              "rounded-sm border px-6 py-3",
              prompt.trim()
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-primary/70 bg-primary text-primary-foreground opacity-65 hover:opacity-80",
            )}
          >
            {generate.isPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              "Plant Seed →"
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
    </section>
  );
}
