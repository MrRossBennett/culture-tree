export function AppFooter() {
  return (
    <footer className="relative z-10 mt-auto w-full max-w-3xl border-t border-border/60 px-4 py-10 sm:px-6 md:px-0 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="font-body max-w-xl text-sm leading-relaxed text-muted-foreground">
          Culture Tree maps the hidden connections between creative works, places, events, and
          people. Not an algorithm — a curator.
        </p>
        <p className="shrink-0 font-mono text-sm tracking-wide text-muted-foreground tabular-nums">
          v0.1
        </p>
      </div>
    </footer>
  );
}
