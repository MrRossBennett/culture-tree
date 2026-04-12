import { HomeThemePill } from "~/components/home/home-theme-pill";

export function HomeHeader() {
  return (
    <header className="relative z-10 flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-6 sm:px-6 md:px-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-heading text-xl tracking-tight text-foreground sm:text-2xl">
          Culture Tree
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase opacity-80">
          Beta
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <p className="hidden font-mono text-[0.65rem] tracking-wide text-muted-foreground sm:block">
          3 seeds remaining
        </p>
        <HomeThemePill />
        <div
          className="font-heading flex size-9 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground"
          title="Account"
        >
          J
        </div>
      </div>
    </header>
  );
}
