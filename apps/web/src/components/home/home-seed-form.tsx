import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui/lib/utils";

const DEPTH_OPTIONS = ["shallow", "standard", "deep"] as const;
const TONE_OPTIONS = ["accessible", "mixed", "deep-cuts"] as const;

function OptionRow({
  id,
  label,
  options,
  active,
}: {
  readonly id: string;
  readonly label: string;
  readonly options: readonly string[];
  readonly active: string;
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
          const isActive = opt === active;
          return (
            <Button
              key={opt}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={isActive}
              className={cn(
                "rounded-full border px-4 font-mono text-xs tracking-wide capitalize",
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
  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-8 px-4 sm:px-6 md:px-0">
      <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
        <textarea
          readOnly
          rows={4}
          placeholder="A film, a band, an era, a feeling..."
          className={cn(
            "font-body w-full resize-y rounded-lg border border-border bg-card px-6 py-5 text-base text-foreground shadow-none outline-none",
            "placeholder:text-muted-foreground/80",
            "resize-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          )}
        />

        <div className="space-y-5">
          <OptionRow id="depth" label="Depth" options={DEPTH_OPTIONS} active="standard" />
          <OptionRow id="tone" label="Tone" options={TONE_OPTIONS} active="mixed" />
        </div>

        <Button
          type="submit"
          variant="secondary"
          disabled
          className="font-body h-12 w-full rounded-lg text-base font-normal tracking-tight"
        >
          Plant seed
        </Button>
      </form>
    </section>
  );
}
