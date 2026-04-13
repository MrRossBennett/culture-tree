import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

export function HomeRecentTrees() {
  const { data } = useQuery(myCultureTreesQueryOptions());
  if (!data?.recent.length) {
    return null;
  }

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-4 px-4 sm:px-6 md:px-0">
      <h2 className="font-heading text-lg text-foreground sm:text-xl">Your recent trees</h2>
      <ul className="font-body space-y-2 text-sm">
        {data.recent.map((t) => (
          <li key={t.id}>
            <Link
              to="/tree/$treeId"
              params={{ treeId: t.id }}
              className="text-primary underline-offset-4 hover:underline"
            >
              {t.seedQuery}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
