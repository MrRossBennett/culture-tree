import { backfillEntityImageProvenance } from "../src/server/entity-resolver.server";

const result = await backfillEntityImageProvenance();

console.log(
  `Backfilled entity image provenance: scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped}`,
);
