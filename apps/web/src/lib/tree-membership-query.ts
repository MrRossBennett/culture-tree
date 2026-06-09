import { queryOptions } from "@tanstack/react-query";

import { $listTreesContainingBranch } from "~/server/entity-resolver";

export function treeMembershipQueryOptions({
  sourceTreeId,
  sourceBranchId,
}: {
  sourceTreeId: string;
  sourceBranchId: string;
}) {
  return queryOptions({
    queryKey: ["tree-membership", sourceTreeId, sourceBranchId] as const,
    queryFn: () => $listTreesContainingBranch({ data: { sourceTreeId, sourceBranchId } }),
  });
}
