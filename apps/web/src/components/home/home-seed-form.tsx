import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

const DEPTH_OPTIONS = ["shallow", "standard", "deep"] as const;
type DepthOption = (typeof DEPTH_OPTIONS)[number];

const TONE_OPTIONS = ["accessible", "mixed", "deep-cuts"] as const;
type ToneOption = (typeof TONE_OPTIONS)[number];

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
  const [depth] = useState<DepthOption>("standard");
  const [tone] = useState<ToneOption>("mixed");
  const loggedIn = Boolean(user);

  const generate = useMutation({
    mutationFn: async () => {
      const query = prompt.trim();
      if (!query) {
        throw new Error("Enter a seed first.");
      }
      return $generateCultureTree({
        data: { query, depth, tone },
      });
    },
    onSuccess: ({ treeId }) => {
      void queryClient.invalidateQueries({ queryKey: myCultureTreesQueryOptions().queryKey });
      toast.success("Your culture tree is ready.");
      void navigate({ to: "/tree/$treeId", params: { treeId } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not generate tree.");
    },
  });

  return (
    <section className="relative z-10 mx-auto w-full max-w-xl space-y-6 px-4 sm:px-6 md:px-0">
      <form
        className="space-y-5"
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
        <div className="relative">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter an album, film, book, era..."
            maxLength={200}
            className={cn(
              "font-body w-full bg-transparent text-foreground outline-none",
              "border-0 border-b border-border pr-32 pb-3 text-2xl",
              "placeholder:text-muted-foreground",
              "transition-colors focus:border-primary",
              "caret-primary",
            )}
          />
          <button
            type="submit"
            disabled={generate.isPending}
            onMouseEnter={() => onSeedHover?.(true)}
            onMouseLeave={() => onSeedHover?.(false)}
            className={cn(
              "absolute right-0 bottom-2 font-mono text-xs tracking-[0.08em] uppercase transition-colors",
              "rounded-sm border border-border px-4 py-2",
              prompt.trim()
                ? "border-amber bg-amber text-amber-foreground hover:opacity-90"
                : "border-border/40 text-muted-foreground/40",
            )}
          >
            {generate.isPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              "Plant Seed →"
            )}
          </button>
        </div>

        {loggedIn ? <SeedCountLine /> : null}
      </form>
    </section>
  );
}
