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
    <header className="relative z-10 flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-6 sm:px-6 md:px-0">
      <Link
        to="/"
        className="flex min-w-0 items-baseline gap-2 rounded-sm ring-ring/50 outline-none focus-visible:ring-[3px]"
      >
        <span className="font-heading text-xl text-foreground sm:text-3xl">Culture Tree</span>
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase opacity-80">
          Beta
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
          <Link
            to="/settings"
            className="font-heading flex size-9 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground hover:opacity-90"
            title="Settings"
          >
            {avatarInitial(user.name, user.email)}
          </Link>
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
  );
}
