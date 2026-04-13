import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "~/components/home/home-page";
import { myCultureTreesQueryOptions } from "~/lib/my-culture-trees-query";

export const Route = createFileRoute("/")({
  component: HomeRoute,
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });
    if (user) {
      await context.queryClient.ensureQueryData(myCultureTreesQueryOptions());
    }
  },
});

function HomeRoute() {
  return <HomePage />;
}
