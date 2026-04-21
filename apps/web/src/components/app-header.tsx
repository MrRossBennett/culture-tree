import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { HomeThemePill } from "~/components/home/home-theme-pill";
import { useOpenSignIn } from "~/components/sign-in-dialog-host";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

function avatarInitial(name: string | null | undefined, email: string | null | undefined): string {
  const s = (name ?? email ?? "?").trim();
  return s.slice(0, 1).toUpperCase();
}

export function AppHeader() {
  const { openSignIn } = useOpenSignIn();
  const { data: user } = useQuery(authQueryOptions());
  const { data: trees } = useQuery({
    ...myCultureTreesQueryOptions(),
    enabled: Boolean(user),
  });

  return (
    <div className="mx-auto w-full border-b border-border/60">
      <header className="relative z-10 flex w-full items-center justify-between gap-4 py-2 sm:px-6">
        <Link
          to="/"
          className="flex min-w-0 items-baseline gap-2 rounded-sm ring-ring/50 outline-none focus-visible:ring-[3px]"
        >
          <span className="font-heading text-xl tracking-tight text-foreground sm:text-2xl">
            Culture Tree
          </span>
          <span className="font-body text-sm text-muted-foreground">
            Cultural curation for the curious
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {user ? (
            <p className="max-w-36 truncate font-mono text-[0.65rem] tracking-wide text-muted-foreground sm:max-w-none">
              {trees ? `${trees.count} seed${trees.count === 1 ? "" : "s"} planted` : "…"}
            </p>
          ) : (
            <button
              type="button"
              onClick={openSignIn}
              className="shrink-0 font-mono text-[0.65rem] tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sign in
            </button>
          )}
          <HomeThemePill />
          {user ? (
            user.username ? (
              <Link
                to="/curator/$username"
                params={{ username: user.username }}
                className="font-heading flex size-9 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground hover:opacity-90"
                title="Your profile"
              >
                {avatarInitial(user.name, user.email)}
              </Link>
            ) : (
              <Link
                to="/onboarding"
                className="font-heading flex size-9 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground hover:opacity-90"
                title="Pick a username"
              >
                {avatarInitial(user.name, user.email)}
              </Link>
            )
          ) : (
            <div
              className="font-heading flex size-9 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground"
              title="Sign in to save trees"
            >
              ?
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
