export function AppFooter() {
  return (
    <footer className="relative z-10 mt-auto w-full max-w-3xl border-t border-border/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <h2 className="font-heading text-xl text-foreground">Culture Tree</h2>
        <p className="font-body max-w-xl text-sm leading-relaxed text-muted-foreground">
          Cultural curation for the curious
        </p>
        <p className="shrink-0 font-mono text-sm tracking-wide text-muted-foreground tabular-nums">
          v0.1
        </p>
      </div>
    </footer>
  );
}
