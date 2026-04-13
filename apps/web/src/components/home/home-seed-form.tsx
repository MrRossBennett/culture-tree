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

export function HomeSeedForm() {
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
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-8 px-4 sm:px-6 md:px-0">
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!loggedIn || !prompt.trim() || generate.isPending) {
            return;
          }
          generate.mutate();
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => writeSeedPrompt(e.target.value)}
          rows={2}
          placeholder="A film, a band, an era, a feeling..."
          suppressHydrationWarning
          className={cn(
            "font-body w-full resize-y rounded-lg border border-border bg-card px-6 py-5 text-base text-foreground shadow-none outline-none",
            "placeholder:text-muted-foreground/80",
            "resize-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          )}
        />

        <div className="space-y-5">
          <OptionRow
            id="depth"
            label="Depth"
            options={DEPTH_OPTIONS}
            value={depth}
            onChange={setDepth}
          />
          <OptionRow
            id="tone"
            label="Tone"
            options={TONE_OPTIONS}
            value={tone}
            onChange={setTone}
          />
        </div>

        {loggedIn ? (
          <div className="space-y-2">
            <Button
              type="submit"
              variant="secondary"
              disabled={!prompt.trim() || generate.isPending}
              className="font-body h-12 w-full rounded-lg text-base font-normal tracking-tight"
            >
              {generate.isPending ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Growing…
                </>
              ) : (
                "Plant seed"
              )}
            </Button>
            <SeedCountLine />
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="font-body h-12 w-full rounded-lg text-base font-normal tracking-tight"
            onClick={openSignIn}
          >
            Sign in to plant your first seed
          </Button>
        )}
      </form>
    </section>
  );
}
