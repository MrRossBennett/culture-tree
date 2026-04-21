import { cn } from "@repo/ui/lib/utils";

export function HomeHero({ seedHovered = false }: { readonly seedHovered?: boolean }) {
  return (
    <section className="relative z-10 w-full text-center">
      <div
        className={cn(
          "mb-8 flex justify-center transition-all duration-700",
          seedHovered ? "opacity-100" : "opacity-30",
        )}
      >
        <svg
          width="48"
          height="60"
          viewBox="0 0 32 40"
          fill="none"
          strokeWidth="1"
          className={cn(
            "transition-colors duration-700",
            seedHovered ? "text-amber" : "text-primary",
          )}
        >
          <line x1="16" y1="36" x2="16" y2="4" stroke="currentColor" />
          <line x1="16" y1="16" x2="8" y2="8" stroke="currentColor" />
          <line x1="16" y1="22" x2="24" y2="14" stroke="currentColor" />
          <line x1="16" y1="28" x2="10" y2="22" stroke="currentColor" />
          <circle cx="16" cy="36" r="2" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <h1 className="font-heading mb-6 text-5xl font-bold text-foreground">
        Join the dots between
        <br />
        <em className="text-muted-foreground italic">everything</em> you love.
      </h1>
    </section>
  );
}
