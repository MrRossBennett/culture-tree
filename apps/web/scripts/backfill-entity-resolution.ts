import { backfillEntityResolutionJobs } from "../src/server/entity-resolver.server";

const result = await backfillEntityResolutionJobs();

console.log(JSON.stringify(result, null, 2));
