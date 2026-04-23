# Culture Tree

Culture Tree is an AI-led recommendation engine and TanStack Start app that turns a cultural seed into a connected map of music, films, books, artists, people, scenes, and influences. An LLM generates the initial tree, then the enrichment pipeline layers in media metadata from public APIs.

The repository includes the web app, shared UI primitives, auth, database schema/migrations, an AI-assisted recommendation engine, fixtures, and tests.

## Goodies

- **Full-stack product engineering:** TanStack Start, React, server functions, Drizzle ORM, PostgreSQL, Better Auth and shared packages.
- **AI application architecture:** structured generation prompts, schema validation with Zod, fixture-backed mock mode and enrichment pipelines.
- **Product polish:** authenticated user flows, public/private trees, node search, curated tree pages and reusable `@repo/ui` components.
- **Engineering hygiene:** pnpm workspace packages, Vite+ validation, typed database schema, migrations, docs and focused tests.

## Stack

- TypeScript, React, TanStack Start, TanStack Router, TanStack Query
- Drizzle ORM, PostgreSQL, Better Auth
- Vite+, pnpm workspaces, shadcn/ui-style shared components
- AI SDK with Anthropic, plus TMDB, Google Books and Wikipedia enrichment

## Getting Started

> [!IMPORTANT]
> This project requires [Vite+ `vp`](https://viteplus.dev/guide/#install-vp) and [pnpm](https://pnpm.io/installation) to be installed.

```bash
pnpm install
docker-compose up -d
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
pnpm db migrate
pnpm dev:web
```

Required local environment values are documented in `apps/web/.env.example`. Use `MOCK_ENGINE=true` if you want to run the app against committed fixtures without making LLM calls.

## Validation

```bash
pnpm lint
pnpm --filter @repo/web test
pnpm --filter @repo/engine test
```

## Documentation

- `docs/ARCHITECTURE.md` explains the product architecture and generation/enrichment flow.
- `docs/API_CONNECTIONS.md` documents third-party API usage and credential expectations.
- `docs/MONOREPO.md` describes the workspace layout and package responsibilities.
