import { Button } from "@repo/ui/components/button";

const SUGGESTIONS = [
  "OK Computer — Radiohead",
  "Grimy New York 70s",
  "Stalker (1979)",
  "Laurel Canyon 1969",
  "Patti Smith",
  "Béla Tarr",
  "Hacienda Manchester",
  "Japanese city pop 1980s",
] as const;

export function HomeSuggestions() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-4 px-4 pb-8 sm:px-6 md:px-0">
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
        Try something
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((label) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            className="font-body rounded-lg border-border/80 px-3.5 text-sm font-normal tracking-tight text-muted-foreground capitalize italic"
          >
            {label}
          </Button>
        ))}
      </div>
    </section>
  );
}
