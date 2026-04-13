import { queryOptions } from "@tanstack/react-query";

import { $listMyCultureTrees } from "~/server/culture-trees";

export function myCultureTreesQueryOptions() {
  return queryOptions({
    queryKey: ["culture-trees", "mine"] as const,
    queryFn: () => $listMyCultureTrees(),
  });
}
