import { defineRelationsPart } from "drizzle-orm";

import * as schema from "./";

export const relations = defineRelationsPart(schema, (_r) => ({
  // Define your relations here
  // https://orm.drizzle.team/docs/relations-v2
}));
