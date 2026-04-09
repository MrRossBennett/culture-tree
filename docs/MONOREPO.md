# Culture Tree — Monorepo Structure

## Based on tanstarter-plus

The project is built on [mugnavo/tanstarter-plus](https://github.com/mugnavo/tanstarter-plus),
which provides the monorepo skeleton, web app, auth, database, and UI
out of the box. We add the engine and schemas packages on top.

### What the template gives us (don't rebuild)

| What       | Where                                     | Details                                |
| ---------- | ----------------------------------------- | -------------------------------------- |
| Monorepo   | Vite+ (`vp`) + pnpm workspaces + catalogs | NOT Turborepo                          |
| Web app    | `apps/web/`                               | TanStack Start + Router + Query + Form |
| Auth       | `packages/auth/`                          | Better Auth, already wired up          |
| Database   | `packages/db/`                            | Drizzle ORM + PostgreSQL + Drizzle Kit |
| Components | `packages/ui/`                            | shadcn/ui + Base UI + Remix Icon       |
| Styling    | Tailwind CSS                              | Configured across all packages         |
| Config     | `tooling/tsconfig/`                       | Shared TypeScript config               |
| Local DB   | `docker-compose.yml`                      | Postgres via Docker Compose            |
| React      | React 19 + React Compiler                 | Already configured                     |
| Vite       | Vite 8 + Nitro v3                         | Build + dev server                     |

### What we add

| What         | Where               | Details                                      |
| ------------ | ------------------- | -------------------------------------------- |
| Engine       | `packages/engine/`  | AI generation + enrichment pipeline          |
| Schemas      | `packages/schemas/` | Shared Zod types for tree, input, enrichment |
| Eval scripts | `scripts/`          | Quality scoring, batch eval                  |
| Admin app    | `apps/admin/`       | Internal dashboard (later)                   |

---

## Updated Structure

```
culture-tree/                         ← tanstarter-plus base
├── apps/
│   ├── web/                          ← TanStack Start (from template)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx         ← search input + tree display
│   │   │   │   └── tree.$treeId.tsx  ← view / share a saved tree
│   │   │   ├── server/
│   │   │   │   └── culture-tree.ts   ← server fns wrapping engine
│   │   │   ├── components/
│   │   │   │   ├── SearchInput.tsx
│   │   │   │   ├── TreeDisplay.tsx
│   │   │   │   └── nodes/
│   │   │   │       ├── MediaNodeCard.tsx
│   │   │   │       ├── PlaceNodeCard.tsx
│   │   │   │       └── EventNodeCard.tsx
│   │   │   └── lib/
│   │   │       └── tree-utils.ts
│   │   ├── .env
│   │   └── vite.config.ts
│   └── admin/                        ← later phase
├── packages/
│   ├── auth/                         ← Better Auth (from template)
│   ├── db/                           ← Drizzle + Postgres (from template)
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── auth.schema.ts    ← from template
│   │   │   │   ├── trees.ts          ← ADD: saved trees
│   │   │   │   ├── enrichments.ts    ← ADD: enrichment cache
│   │   │   │   ├── ratings.ts        ← ADD: user ratings
│   │   │   │   └── index.ts
│   │   │   └── ...
│   │   └── drizzle/
│   ├── ui/                           ← shadcn/ui (from template)
│   ├── engine/                       ← ADD: the AI brain
│   │   ├── src/
│   │   │   ├── generation/
│   │   │   │   ├── pipeline.ts       ← multi-pass orchestrator
│   │   │   │   └── prompts.ts        ← system prompt + few-shot
│   │   │   ├── enrichment/
│   │   │   │   ├── pipeline.ts       ← orchestrator + registry
│   │   │   │   ├── cache.ts          ← Postgres enrichment cache
│   │   │   │   ├── books.ts
│   │   │   │   ├── films.ts
│   │   │   │   ├── music.ts
│   │   │   │   ├── youtube.ts
│   │   │   │   ├── wikipedia.ts      ← P2
│   │   │   │   └── places.ts         ← P2
│   │   │   ├── __tests__/
│   │   │   │   ├── pipeline.test.ts
│   │   │   │   ├── prompts.test.ts
│   │   │   │   ├── books.test.ts
│   │   │   │   ├── films.test.ts
│   │   │   │   └── music.test.ts
│   │   │   └── index.ts              ← public API
│   │   ├── fixtures/
│   │   │   ├── ok-computer-shallow.json
│   │   │   ├── ok-computer-standard.json
│   │   │   ├── grimy-new-york-70s-standard.json
│   │   │   ├── blood-meridian-standard.json
│   │   │   └── nick-cave-boatmans-call-deep.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── schemas/                      ← ADD: shared Zod types
│       ├── src/
│       │   ├── tree.ts
│       │   ├── input.ts
│       │   ├── enrichment.ts
│       │   ├── quality.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/                          ← ADD: eval harness
│   ├── eval.ts
│   ├── eval-batch.ts
│   └── eval/
│       ├── queries.ts
│       ├── scorer.ts
│       └── report.ts
├── tooling/
│   └── tsconfig/                     ← from template
├── docker-compose.yml                ← from template (local Postgres)
├── vite.config.ts                    ← from template
├── pnpm-workspace.yaml              ← from template
└── package.json
```

---

## New Packages to Create

### packages/schemas

```json
{
  "name": "@repo/schemas",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "catalog:"
  }
}
```

Note: tanstarter-plus uses `@repo/` as the package scope (not `@ct/`).
Use pnpm catalogs for dependency versions where possible.

### packages/engine

```json
{
  "name": "@repo/engine",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@repo/schemas": "workspace:*",
    "ai": "^6",
    "@ai-sdk/anthropic": "^1",
    "zod": "catalog:"
  },
  "devDependencies": {
    "vitest": "catalog:"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

Public API:

```typescript
// packages/engine/src/index.ts
export { generateTree } from "./generation/pipeline";
export { enrichTree } from "./enrichment/pipeline";
```

### Register in pnpm-workspace.yaml

The template already has:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

New packages under `packages/` are picked up automatically.

---

## DB Schema Additions

The template's `packages/db/` already has auth schemas. We add
our tables alongside them.

```typescript
// packages/db/src/schema/trees.ts
import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const trees = pgTable("trees", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // links to Better Auth user
  query: text("query").notNull(),
  queryHash: text("query_hash").notNull(),
  depth: text("depth").notNull(),
  tone: text("tone").notNull(),
  treeData: jsonb("tree_data").notNull(),
  enrichmentData: jsonb("enrichment_data"),
  shareSlug: text("share_slug").unique(),
  isPublic: integer("is_public").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// packages/db/src/schema/enrichments.ts
export const enrichmentCache = pgTable("enrichment_cache", {
  id: text("id").primaryKey(),
  searchHintHash: text("search_hint_hash").notNull().unique(),
  nodeType: text("node_type").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// packages/db/src/schema/ratings.ts
export const ratings = pgTable("ratings", {
  id: text("id").primaryKey(),
  treeId: text("tree_id").notNull(),
  nodeId: text("node_id").notNull(),
  userId: text("user_id").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

Export from the existing `packages/db/src/schema/index.ts`.

Then generate and run the migration:

```bash
pnpm db generate
pnpm db migrate
```

---

## Wiring the Engine into the Web App

The server function in `apps/web/` wraps the engine:

```typescript
// apps/web/src/server/culture-tree.ts
import { createServerFn } from "@tanstack/react-start";
import { generateTree, enrichTree } from "@repo/engine";
import { TreeRequestSchema } from "@repo/schemas";
import okComputerFixture from "@repo/engine/fixtures/ok-computer-standard.json";

export const createCultureTree = createServerFn({ method: "POST" })
  .validator(TreeRequestSchema)
  .handler(async ({ data }) => {
    // MOCK_ENGINE=true during UI development — no API calls
    if (process.env.MOCK_ENGINE === "true") {
      return { tree: okComputerFixture, enrichments: {} };
    }

    const tree = await generateTree(data);
    const enrichments = await enrichTree(tree);
    return { tree, enrichments: Object.fromEntries(enrichments) };
  });
```

Add `@repo/engine` and `@repo/schemas` to `apps/web/package.json`:

```json
{
  "dependencies": {
    "@repo/engine": "workspace:*",
    "@repo/schemas": "workspace:*"
  }
}
```

---

## Dev Commands

Tanstarter-plus uses `vp` (Vite+) not `turbo`:

```bash
# Run the web app (+ local Postgres via Docker)
./dev.sh
# or just the web app
./dev.sh web

# Standard dev
pnpm dev

# Run engine tests
pnpm --filter @repo/engine test

# Database
pnpm db generate         # generate migration from schema changes
pnpm db migrate          # apply migrations
pnpm db studio           # open Drizzle Studio

# Eval scripts
pnpm eval -- "OK Computer — Radiohead" standard
pnpm eval:batch -- standard "prompt-v3"

# shadcn components
pnpm ui add card         # add a component to packages/ui

# Format + lint
pnpm check
```

Add eval scripts to root `package.json`:

```json
{
  "scripts": {
    "eval": "tsx scripts/eval.ts",
    "eval:batch": "tsx scripts/eval-batch.ts"
  }
}
```

---

## Environment Variables

The template already has `.env.example` files in `apps/web/` and
`packages/db/`. Add engine-specific vars to `apps/web/.env`:

```env
# Already from template:
DATABASE_URL=postgresql://user:pass@localhost:5432/culture_tree
BETTER_AUTH_SECRET=...

# ADD for Culture Tree engine:
MOCK_ENGINE=true                     # set false for real API calls
ANTHROPIC_API_KEY=sk-ant-...
TMDB_ACCESS_TOKEN=eyJ...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
YOUTUBE_API_KEY=AIza...
GOOGLE_BOOKS_API_KEY=...

# Phase 2
GOOGLE_PLACES_API_KEY=...
```

---

## Build Order

```
tooling/tsconfig
       ↓
  @repo/schemas
       ↓
@repo/engine   @repo/db   @repo/auth   @repo/ui
       ↓           ↓          ↓            ↓
       └──────── @repo/web ────────────────┘
```

Vite+ handles dependency resolution via pnpm workspaces.
No explicit `dependsOn` config needed like Turborepo.

---

## What NOT to Rebuild

These are already working from the template. Don't touch them
unless you need to customise:

- Auth flow (Better Auth — login, signup, sessions)
- Drizzle client setup (`packages/db/src/client.ts`)
- shadcn/ui setup and theming (`packages/ui/`)
- Tailwind config
- TypeScript config (`tooling/tsconfig/`)
- Docker Compose for local Postgres
- Vite config
- React Compiler setup

---

## First Steps (in order)

1. **Create `packages/schemas/`** — the Zod types for tree, input,
   enrichment. Everything else depends on this.

2. **Create `packages/engine/`** — start with just the generation
   pipeline and system prompt. No enrichment yet.

3. **Generate one real fixture** — run the engine once against Claude,
   save the JSON. Set `MOCK_ENGINE=true`.

4. **Build the MVP page in `apps/web/`** — text input, generate button,
   tree rendered with shadcn cards using the fixture. All free.

5. **Add enrichment** — books first (Google Books, simplest API). Then
   films (TMDB). Then music (Spotify). Build the cache immediately.

6. **Add DB tables** — trees, enrichment cache. Wire up saving.

7. **Add eval scripts** — scorer + batch runner in `scripts/`.

8. **Turn off `MOCK_ENGINE`** — the app now calls the real engine.
   First real end-to-end test.
