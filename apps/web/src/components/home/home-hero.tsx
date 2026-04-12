export function HomeHero() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-6 px-4 text-left sm:px-6 md:px-0">
      <h1 className="font-heading text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
        <span className="block">Plant a seed.</span>
        <span className="-ml-2 block text-primary italic">Watch it grow.</span>
      </h1>
      <p className="font-body max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Enter a film, album, book, place, era, or vibe — and discover the hidden connections that
        link it to the rest of culture.
      </p>
    </section>
  );
}
