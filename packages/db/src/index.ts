import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schemas from "./schema";
import { relations } from "./schema/relations";

const { relations: authRelations, ...schema } = schemas;

/** Node tries IPv6 for `localhost` first; Docker Postgres is usually IPv4-only → ECONNREFUSED. */
function resolveDatabaseUrl(raw: string | undefined): string {
  if (raw == null || raw.trim() === "") {
    throw new Error("DATABASE_URL is missing. Set it in apps/web/.env (see .env.example).");
  }
  try {
    const url = new URL(raw);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.href;
  } catch {
    return raw;
  }
}

const client = postgres(resolveDatabaseUrl(process.env.DATABASE_URL));

export const db = drizzle({
  client,
  schema,
  // authRelations must come first, since it's using defineRelations as the main relation
  // https://orm.drizzle.team/docs/relations-v2#relations-parts
  relations: { ...authRelations, ...relations },
  casing: "snake_case",
});
