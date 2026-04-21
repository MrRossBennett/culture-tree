import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  getSeedPromptServerSnapshot,
  getSeedPromptSnapshot,
  subscribeSeedPrompt,
  writeSeedPrompt,
} from "~/components/home/seed-prompt-storage";
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

function OptionRow<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label
        id={`${id}-label`}
        className="font-mono text-[0.65rem] font-normal tracking-[0.16em] text-muted-foreground uppercase"
      >
        {label}
      </Label>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
        {options.map((opt) => {
          const isActive = opt === value;
          return (
            <Button
              key={opt}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={isActive}
              onClick={() => onChange(opt)}
              className={cn(
                "rounded-lg border px-4 font-mono text-xs tracking-wide capitalize",
                isActive &&
                  "border-primary bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15",
                !isActive && "text-muted-foreground opacity-90",
              )}
            >
              {opt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function HomeSeedForm({
  onSeedHover,
}: {
  readonly onSeedHover?: (hovered: boolean) => void;
}) {
  const { openSignIn } = useOpenSignIn();
  const { data: user } = useQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [depth, setDepth] = useState<DepthOption>("standard");
  const [tone, setTone] = useState<ToneOption>("mixed");
  const prompt = useSyncExternalStore(
    subscribeSeedPrompt,
    getSeedPromptSnapshot,
    getSeedPromptServerSnapshot,
  );
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
            onChange={(e) => writeSeedPrompt(e.target.value)}
            placeholder="Enter an album, film, book, era..."
            suppressHydrationWarning
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
