import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/credits")({
  component: CreditsRoute,
});

const PROVIDERS = [
  {
    name: "The Movie Database (TMDB)",
    href: "https://www.themoviedb.org/",
    note: "Film and TV metadata, posters, ratings, and trailer references.",
  },
  {
    name: "Google Books",
    href: "https://books.google.com/",
    note: "Book metadata, cover image links, and edition links.",
  },
  {
    name: "Wikipedia and Wikimedia",
    href: "https://www.wikipedia.org/",
    note: "Reference pages, summaries, lead images, and context for cultural subjects.",
  },
  {
    name: "MusicBrainz",
    href: "https://musicbrainz.org/",
    note: "Music identities for artists, release groups, and recordings.",
  },
  {
    name: "Cover Art Archive",
    href: "https://coverartarchive.org/",
    note: "Album artwork linked through MusicBrainz release groups.",
  },
] as const;

function CreditsRoute() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="space-y-3">
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Credits</p>
        <h1 className="font-heading text-4xl tracking-tight text-foreground">Sources</h1>
        <p className="font-body max-w-2xl text-base leading-relaxed text-muted-foreground">
          Culture Tree uses external cultural data and image providers for branch context. Images
          remain linked to their source providers, and posters, covers, and artwork should not be
          assumed to be public domain.
        </p>
      </div>

      <section className="divide-y divide-border/60 border-y border-border/60">
        {PROVIDERS.map((provider) => (
          <article
            key={provider.name}
            className="grid gap-2 py-5 sm:grid-cols-[12rem_1fr] sm:gap-6"
          >
            <a
              href={provider.href}
              className="font-heading text-lg text-foreground underline-offset-4 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              {provider.name}
            </a>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              {provider.note}
            </p>
          </article>
        ))}
      </section>

      <p className="font-body text-sm text-muted-foreground">
        <Link to="/" className="text-foreground underline-offset-4 hover:underline">
          Back to Culture Tree
        </Link>
      </p>
    </main>
  );
}
