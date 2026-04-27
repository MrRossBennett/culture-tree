import type { TreeRequest } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";

export type CultureTreeTone = TreeRequest["tone"];

export const CULTURE_TREE_TONE_OPTIONS = [
  "accessible",
  "mixed",
  "deep-cuts",
] as const satisfies readonly CultureTreeTone[];

const CULTURE_TREE_TONE_LABELS = {
  accessible: "Open door",
  mixed: "Curated",
  "deep-cuts": "Deep cuts",
} as const satisfies Record<CultureTreeTone, string>;

export function CultureTreeToneSelector({
  value,
  disabled = false,
  className,
  onValueChange,
}: {
  readonly value: CultureTreeTone;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onValueChange: (value: CultureTreeTone) => void;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
        Discovery tone
      </p>
      <div className="grid grid-cols-3 rounded border border-border/50 bg-card/20 p-1">
        {CULTURE_TREE_TONE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={value === option}
            onClick={() => onValueChange(option)}
            className={cn(
              "min-h-8 rounded-sm px-2 font-mono text-[0.62rem] tracking-[0.08em] uppercase transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none disabled:cursor-default disabled:opacity-50",
              value === option
                ? "bg-foreground text-background"
                : "text-muted-foreground/60 hover:bg-background/70 hover:text-foreground",
            )}
          >
            {CULTURE_TREE_TONE_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
