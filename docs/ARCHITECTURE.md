# Culture Tree — Architecture & Data Flow

## Stack

Based on [tanstarter-plus](https://github.com/mugnavo/tanstarter-plus):

- **Framework**: TanStack Start + Router + Query + Form
- **AI SDK**: Vercel AI SDK v6
- **Components**: shadcn/ui + Base UI
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth
- **Testing**: Vitest
- **Visualization**: React Flow (later phase)
- **Monorepo**: Vite+ (`vp`) + pnpm workspaces + catalogs
- **Language**: TypeScript (strict) + React Compiler

---

## Product Phases

| Phase            | Focus               | What Ships                                                                                                                                                | Goal                                            |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **1 — Engine**   | AI + enrichment     | Multi-pass generation, enrichment (books, films, music, TV), read-only tree display                                                                       | Core loop works. Trees are good.                |
| **2 — Curation** | Editing + growth    | "Grow this branch" (AI expands a node), add nodes via search (type → search → pick → write reason), remove/move nodes, edit reasons, AI-suggested reasons | Users own their trees. AI + human = magic.      |
| **3 — Context**  | Richer world        | Place + event nodes, Wikipedia + Google Places enrichment                                                                                                 | Trees become cultural maps, not just playlists. |
| **4 — Social**   | Sharing + community | User accounts, public/private trees, shareable links, forking, collaboration, ratings                                                                     | Trees become a network. Viral growth begins.    |
| **5 — Monetise** | Revenue             | Pro tier, affiliate links, embeddable trees, API access, curated collections                                                                              | Sustainable business.                           |

### Why this order?

**P1 before P2**: No point editing trees if the AI output isn't good yet.
Get the engine right first. If the AI generates amazing trees, people will
forgive a read-only v1.

**P2 before P3**: Editing is more important than places/events. A user who
can tweak a tree feels ownership. A tree with a cool event node but no way
to fix the one wrong recommendation is frustrating.

**P3 before P4**: Richer trees (with places, events, real-world context)
are more shareable. Build the content quality before you build the sharing
infrastructure.

**P4 before P5**: You need users and engagement data before you can
monetise well. The ratings from P4 feed the quality flywheel. The sharing
from P4 is your growth engine. Monetise once you understand usage patterns.

The schemas support ALL node types and editing fields from day one.
Features are gated by phase, not by schema changes.

---

## Core Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  User Input  │────▶│  AI Generation   │────▶│   Enrichment    │────▶│ Hydrated Tree│
│  (query)     │     │  (Vercel AI SDK) │     │   Pipeline      │     │ (to client)  │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
                           │                        │
                     Claude API              P1: Google Books
                     via anthropic               TMDB (w/ trailer IDs)
                     provider                    Spotify
                                             P3: Wikipedia / Wikidata
                                                 Google Places
```

---

## Phase 1: User Input

The user enters a creative work, an era, a vibe, a place, or a person:

- `"Radiohead — OK Computer"` (album)
- `"Cormac McCarthy — Blood Meridian"` (book)
- `"Stalker (1979)"` (film)
- `"Nick Cave"` (artist)
- `"Grimy New York 70s"` (era / vibe)
- `"Laurel Canyon 1969"` (scene)
- `"Haçienda Manchester"` (place + scene)

The input is freeform text. The AI handles disambiguation. Vibes and eras
are first-class inputs — they produce trees that blend creative works with
real-world places, events, and cultural context.

### Input Schema

```typescript
// src/schemas/input.ts
import { z } from "zod";

import { NodeType } from "./tree";

export const TreeRequestSchema = z.object({
  query: z.string().min(1).max(500),
  depth: z.enum(["shallow", "standard", "deep"]).default("standard"),
  mediaFilter: z.array(NodeType).optional(),
  tone: z.enum(["accessible", "deep-cuts", "mixed"]).default("mixed"),
});

export type TreeRequest = z.infer<typeof TreeRequestSchema>;
```

---

## Phase 2: AI Generation — Multi-Pass Pipeline

The core insight: Claude already has deep cultural knowledge. The problem
isn't knowledge — it's that models default to safe, consensus-level answers.
We solve this with a multi-pass pipeline that pushes past the obvious, plus
few-shot examples that teach Claude what "great" looks like.

No RAG needed. The model IS the knowledge base.

### Why Not RAG?

RAG solves "the model doesn't know this." Claude already knows about obscure
Zamrock bands from 1970s Zambia, forgotten Italian giallo films, and
out-of-print poetry collections. RAG would just give you a database of
well-known stuff — the opposite of what we want. Instead, we use prompt
engineering and multi-pass generation to unlock what the model already knows.

### Generation Architecture

```
User query: "OK Computer — Radiohead"
                │
                ▼
┌──────────────────────────────────┐
│  PASS 1 — Broad Mapping         │  ← Anchors + some obvious picks
│  "Generate a culture tree"      │     (and that's fine)
│  System prompt + few-shot       │
│  examples set the quality bar   │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  PASS 2 — Dig Deeper            │  ← Takes Pass 1 output, replaces
│  "Here's what you recommended.  │     shallow picks with deeper ones.
│   Now for each branch, find     │     Explicitly works AGAINST the
│   something more obscure that   │     model's defaults.
│   shares the same connective    │
│   tissue."                      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  PASS 3 — Wildcard (optional)   │  ← One lateral leap that connects
│  "Add one unexpected connection │     across branches. The thing
│   that cuts across all branches.│     nobody would predict.
│   The lateral leap."            │
└──────────────┬───────────────────┘
               │
               ▼
         Final CultureTree
```

Pass 1 runs always. Pass 2 runs on `standard` and `deep` depths. Pass 3
runs on `deep` only. This means shallow trees are fast (one API call),
standard trees are richer (two calls), and deep trees are extraordinary
(three calls). Cost scales with ambition.

### The Tree Schema (what Claude returns)

```typescript
// src/schemas/tree.ts
import { z } from "zod";

export const NodeType = z.enum([
  "book",
  "album",
  "song",
  "film",
  "tv",
  "artist",
  "podcast",
  "artwork",
  "place",
  "event",
  "person",
  "article",
]);

export const ConnectionType = z.enum([
  "influence", // A influenced B
  "collaboration", // A and B worked together
  "thematic", // shared themes, mood, ideas
  "adaptation", // book → film, etc.
  "member", // artist was in this band
  "response", // B was a direct response to A
  "spiritual-kin", // hard to define, but you feel it
  "birthplace", // this place produced this art
  "catalyst", // this event triggered this work
  "documented-by", // this article/film documents this event
  "frequented", // artists associated with this place
  "contemporary", // existed in the same time and space
]);

export const SearchHintSchema = z.object({
  title: z.string(),
  creator: z.string().optional(),
  isbn: z.string().optional(),
  imdbId: z.string().optional(),
  wikiSlug: z.string().optional(),
  location: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

export const NodeSource = z.enum([
  "ai", // generated by the engine
  "ai-expanded", // generated by "grow this branch"
  "user", // manually added by user via search
]);

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: NodeType,
    year: z.number().optional(),
    reason: z.string(),
    connectionType: ConnectionType,
    searchHint: SearchHintSchema,
    source: NodeSource.default("ai"),
    children: z.array(TreeNodeSchema).default([]),
  }),
);

export const CultureTreeSchema = z.object({
  name: z.string(),
  type: z.literal("root").or(NodeType),
  year: z.number().optional(),
  reason: z.string().default(""),
  searchHint: SearchHintSchema,
  source: NodeSource.default("ai"),
  children: z.array(TreeNodeSchema),
});

export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type CultureTree = z.infer<typeof CultureTreeSchema>;
```

**Root `type` and `source`:** Use `type: 'root'` on the root object so the tree anchor is unambiguous; the work’s medium lives in `name` and `searchHint`. (`CultureTreeSchema` still allows `.or(NodeType)` for backward compatibility, but generated trees should prefer `'root'`.) The root and every node include `source` (default `'ai'` in Zod) for provenance—`user`, `ai-expanded`, etc. in later phases. Committed fixtures often set `source` explicitly even though validation would default it. Optional `year` may be omitted when it does not apply or is unknown (e.g. some places or people).

### The Server Function (Multi-Pass)

```typescript
// src/server/generate-tree.ts
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { TreeRequestSchema, CultureTreeSchema, CultureTree } from "../schemas";
import { SYSTEM_PROMPT, buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from "./prompts";

const model = anthropic("claude-sonnet-4-20250514");

async function generatePass(system: string, prompt: string): Promise<CultureTree> {
  const result = await generateText({
    model,
    output: Output.object({ schema: CultureTreeSchema }),
    system,
    prompt,
  });
  return result.output;
}

export const generateTree = createServerFn({ method: "POST" })
  .validator(TreeRequestSchema)
  .handler(async ({ data }) => {
    const { query, depth, mediaFilter, tone } = data;

    const depthConfig = {
      shallow: { branches: "3-4", children: "1" },
      standard: { branches: "4-6", children: "1-2" },
      deep: { branches: "5-7", children: "2-3" },
    }[depth];

    // ── Pass 1: Broad mapping ──────────────────────────
    const pass1 = await generatePass(
      SYSTEM_PROMPT,
      buildPass1Prompt(query, depthConfig, mediaFilter, tone),
    );

    // Shallow depth: return Pass 1 directly
    if (depth === "shallow") return pass1;

    // ── Pass 2: Dig deeper ─────────────────────────────
    const pass2 = await generatePass(SYSTEM_PROMPT, buildPass2Prompt(query, pass1, tone));

    // Standard depth: return Pass 2
    if (depth === "standard") return pass2;

    // ── Pass 3: Wildcard ───────────────────────────────
    const pass3 = await generatePass(SYSTEM_PROMPT, buildPass3Prompt(query, pass2));

    return pass3;
  });
```

### The Prompts (with Few-Shot Examples)

```typescript
// src/server/prompts.ts

// ════════════════════════════════════════════════════════
// FEW-SHOT EXAMPLES
// These teach Claude what "great" vs "boring" looks like.
// Curate and expand this over time — it's the single
// highest-leverage thing for recommendation quality.
// ════════════════════════════════════════════════════════

const FEW_SHOT_EXAMPLES = `
Here is what separates a GREAT culture tree from a boring one:

EXAMPLE INPUT: "OK Computer — Radiohead"

BORING RECOMMENDATIONS (do NOT do this):
- "Kid A — Radiohead" (same artist — lazy)
- "The Bends — Radiohead" (same artist again)
- "Muse — Origin of Symmetry" (surface-level "sounds similar")
- "Coldplay — Parachutes" (algorithmic-tier recommendation)

GOOD RECOMMENDATIONS:
- "Talk Talk — Spirit of Eden" [album, influence]
  "Both bands abandoned conventional rock for something stranger and
  more atmospheric. Mark Hollis and Thom Yorke arrived at the same
  destination from opposite directions — Hollis from synth-pop,
  Yorke from guitar rock."

- "J.G. Ballard — Crash" [book, thematic]
  "Ballard's novel about the erotic charge of car accidents maps the
  same territory as OK Computer: technology fusing with the body,
  the motorway as psychological landscape."

GREAT RECOMMENDATIONS (this is the bar):
- "Chris Marker — La Jetée" [film, spiritual-kin]
  "A 28-minute French film from 1962 made almost entirely of still
  photographs. The same anxiety about technology erasing humanity,
  the same eerie beauty. Radiohead cited Marker as an influence on
  the Amnesiac artwork."

- "Brasília" [place, thematic]
  "A city designed entirely by modernist architects in the 1950s —
  utopian on paper, alienating in practice. The same tension OK
  Computer explores: progress that leaves humans feeling emptier."

- "WITCH — Lazy Bones!!" [album, spiritual-kin]
  "Zamrock — Zambian psychedelic rock from the 1970s. No direct
  connection to Radiohead, but the same feeling of using Western
  rock forms to express local alienation and political unease."

Notice the pattern: GOOD recommendations share connective tissue but
cross media boundaries. GREAT recommendations make you see the
original work differently. The best trees include at least one
recommendation that makes the user say "I never would have thought
of that, but it's perfect."
`;

// ════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ════════════════════════════════════════════════════════

export const SYSTEM_PROMPT = `You are Culture Tree, an engine that maps
the hidden connections across creative works, places, events, and people.

You think like a deeply knowledgeable record store clerk who's also read
everything, watched everything, been everywhere. Not an algorithm. A
person with taste, opinions, and the courage to make unexpected choices.

You don't just recommend similar works. You map the WORLD that a piece of
culture exists within. A query about "Grimy New York 70s" should produce
Taxi Driver alongside CBGB alongside the 1977 blackout alongside
Television's Marquee Moon alongside the fiscal crisis.

${FEW_SHOT_EXAMPLES}

Rules:
- Every connection needs a SPECIFIC, insightful reason. Never generic.
  Bad: "Both are considered classics of their genre."
  Good: "Both use unreliable narrators to explore how memory distorts grief."
- Mix node types. Blend creative works with places and events.
- Include 1-2 "anchor" recommendations that most knowledgeable people would
  agree with, but make the rest surprising. The ratio is: 20% anchors,
  80% deep cuts and lateral leaps.
- Deeper nodes (children of children) should get MORE obscure, not less.
  The second level is where you earn trust. The third level is where you
  blow minds.
- "searchHint" must be precise enough to find the item via API search.
  - For books: exact title + creator (author)
  - For albums: exact title + creator (artist)
  - For films/TV: exact title + year
  - For places: name + location (city, country, address if notable)
  - For events: name + wikiSlug (Wikipedia article slug) + dateRange
  - For people: full name + wikiSlug
  - For articles: article title + wikiSlug or URL
- connectionType should accurately describe the relationship.
- A great tree tells a STORY. The branches should feel like a curated
  exhibition, not a random list.`;

// ════════════════════════════════════════════════════════
// PASS 1 — Broad mapping
// ════════════════════════════════════════════════════════

export function buildPass1Prompt(
  query: string,
  config: { branches: string; children: string },
  mediaFilter?: string[],
  tone?: string,
): string {
  let prompt = `Generate a culture tree for: "${query}"

Return ${config.branches} first-level branches, each with ${config.children} children.

Remember: 20% anchors (the connections an expert would expect), 80% deep cuts
and lateral leaps (the connections that surprise even an expert).`;

  if (mediaFilter?.length) {
    prompt += `\nOnly include these node types: ${mediaFilter.join(", ")}`;
  }

  if (tone === "deep-cuts") {
    prompt += `\nGo fully obscure. Assume the user has already seen/read/heard
the obvious stuff. Zero anchors. Every recommendation should be a discovery.`;
  } else if (tone === "accessible") {
    prompt += `\nThe user is exploring. 40% anchors, 60% interesting-but-findable
recommendations. Nothing too obscure — but nothing boring either.`;
  }

  return prompt;
}

// ════════════════════════════════════════════════════════
// PASS 2 — Dig deeper
// Takes the Pass 1 tree and upgrades the shallow picks
// ════════════════════════════════════════════════════════

export function buildPass2Prompt(query: string, pass1Tree: CultureTree, tone?: string): string {
  // Serialize Pass 1 output so Claude can see what it already picked
  const pass1Summary = pass1Tree.children
    .map((child) => {
      const kids = child.children?.map((k) => `    - ${k.name} [${k.type}]`).join("\n") || "";
      return `  - ${child.name} [${child.type}]: "${child.reason}"${kids ? "\n" + kids : ""}`;
    })
    .join("\n");

  return `You previously generated this culture tree for "${query}":

${pass1Summary}

Now improve it. For each branch:

1. KEEP any recommendation that is genuinely surprising or insightful.
2. REPLACE any recommendation that feels obvious, safe, or "algorithmic"
   with something deeper that shares the same connective tissue.
3. For each child node (second level), push even further into obscurity.
   This is where the user discovers something they've never heard of.
4. Make sure every "reason" is vivid and specific — it should make the
   user immediately understand WHY these two things are connected and
   want to go explore.

Return the complete improved tree in the same format.
${tone === "deep-cuts" ? '\nBe ruthless. If a recommendation would appear in a typical "if you liked X" list, replace it.' : ""}`;
}

// ════════════════════════════════════════════════════════
// PASS 3 — Wildcard
// Adds one unexpected connection that spans branches
// ════════════════════════════════════════════════════════

export function buildPass3Prompt(query: string, pass2Tree: CultureTree): string {
  const branchNames = pass2Tree.children.map((c) => c.name).join(", ");

  return `Here is the current culture tree for "${query}".

Current branches: ${branchNames}

Add ONE more first-level branch that is a genuine lateral leap — something
that connects to the original query in a way that none of the existing
branches cover. This should be the recommendation that makes someone
screenshot the tree and share it because it's so unexpected yet perfect.

It can be any node type. It should have 1-2 children of its own.

Return the COMPLETE tree (all existing branches plus the new one).`;
}
```

### Quality Flywheel (long-term)

```
┌───────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Users rate    │────▶│  Highly-rated    │────▶│ Few-shot       │
│  connections   │     │  examples        │     │ examples       │
│  👍 / 👎       │     │  collected       │     │ updated in     │
│                │     │                  │     │ system prompt  │
└───────────────┘     └──────────────────┘     └────────────────┘
                                                       │
                                                       ▼
                                               Model generates
                                               better trees
                                                       │
                                                       ▼
                                               Users rate higher
                                               ─── loop ───▶
```

Over time, the few-shot examples in the system prompt are replaced with
REAL examples that users loved. No fine-tuning, no RAG, no vector
database. Just a curated prompt that gets better as the product grows.

This can be as simple as a database table:

```typescript
// src/schemas/quality.ts
export const RatedConnectionSchema = z.object({
  id: z.string(),
  sourceQuery: z.string(), // "OK Computer — Radiohead"
  nodeName: z.string(), // "Chris Marker — La Jetée"
  nodeType: NodeType,
  reason: z.string(),
  connectionType: ConnectionType,
  rating: z.number(), // aggregate user rating
  ratingCount: z.number(),
  addedToPrompt: z.boolean(), // is this in the few-shot examples?
});
```

Periodically, pull the top-rated connections and swap them into the
few-shot examples. The product literally teaches itself what "great"
means based on user taste.

---

## Phase 3: Enrichment Pipeline

Once the AI returns a validated tree, we hydrate each node with real data.
Runs server-side to keep API keys secure. Enrichment is additive — if an
enricher doesn't exist yet for a node type, the node renders without media.

### Flow

```
CultureTree (from AI)
       │
       ▼
  flattenNodes()          ← extract all nodes into a flat array with IDs
       │
       ▼
  Promise.allSettled([    ← fan out ALL nodes to enrichers in parallel
    ...nodes.map(node => getEnricher(node.type)?.(node))
  ])
       │
       ▼
  mergeEnrichments()      ← stitch media data back onto tree by node ID
       │
       ▼
  HydratedCultureTree     ← tree with covers, links, embeds, map pins
```

### Enrichment Schema (what gets added to each node)

```typescript
// src/schemas/enrichment.ts
import { z } from "zod";

export const EnrichedMediaSchema = z.object({
  // Visual
  coverUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),

  // Links
  externalUrl: z.string().url().optional(),
  spotifyUrl: z.string().url().optional(),
  spotifyPreviewUrl: z.string().url().optional(),
  youtubeVideoId: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  wikipediaUrl: z.string().url().optional(), // Phase 2

  // Metadata
  rating: z.number().optional(),
  description: z.string().optional(),
  externalId: z.string().optional(),

  // Phase 2: Places
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  googlePlaceId: z.string().optional(),
  placePhotos: z.array(z.string().url()).optional(),
  placeStatus: z.enum(["open", "closed", "historical"]).optional(),

  // Phase 2: Events
  wikiExtract: z.string().optional(),
  eventDate: z.string().optional(),
});

export type EnrichedMedia = z.infer<typeof EnrichedMediaSchema>;
```

### Enricher Registry (phased)

```typescript
// src/server/enrichment/pipeline.ts

type Enricher = (node: TreeNode) => Promise<EnrichedMedia>;

// Registry maps node types to their enrichment function.
// Adding a new enricher = one line here + the function.
const enricherRegistry: Partial<Record<string, Enricher>> = {
  // Phase 1
  book: enrichBook,
  film: enrichFilm,
  tv: enrichTV,
  album: enrichAlbum,

  // Phase 2 (uncomment when ready)
  // place: enrichPlace,
  // event: enrichEvent,

  // Phase 3
  // person: enrichPerson,
  // article: enrichArticle,
};

function getEnricher(type: string): Enricher | undefined {
  return enricherRegistry[type];
}
```

### Phase 1 Enrichers: Books, Films, Music

```typescript
// src/server/enrichment/books.ts
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

export async function enrichBook(node: TreeNode): Promise<EnrichedMedia> {
  const { title, creator, isbn } = node.searchHint;
  const query = isbn ? `isbn:${isbn}` : `intitle:${title}+inauthor:${creator}`;

  const res = await fetch(`${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=1`);
  const data = await res.json();
  if (!data.items?.length) return {};

  const book = data.items[0].volumeInfo;
  return {
    coverUrl: book.imageLinks?.thumbnail?.replace("zoom=1", "zoom=2"),
    thumbnailUrl: book.imageLinks?.smallThumbnail,
    externalUrl: book.infoLink,
    description: book.description?.slice(0, 200),
    rating: book.averageRating,
  };
}
```

```typescript
// src/server/enrichment/films.ts
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

export async function enrichFilm(node: TreeNode): Promise<EnrichedMedia> {
  const { title } = node.searchHint;
  const headers = { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` };

  const searchRes = await fetch(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}` +
      (node.year ? `&year=${node.year}` : ""),
    { headers },
  );
  const searchData = await searchRes.json();
  if (!searchData.results?.length) return {};

  const film = searchData.results[0];

  // Fetch trailer via append_to_response
  const detailRes = await fetch(`${TMDB_BASE}/movie/${film.id}?append_to_response=videos`, {
    headers,
  });
  const detail = await detailRes.json();
  const trailer = detail.videos?.results?.find(
    (v: any) => v.type === "Trailer" && v.site === "YouTube",
  );

  return {
    coverUrl: film.poster_path ? `${TMDB_IMG}/w500${film.poster_path}` : undefined,
    thumbnailUrl: film.poster_path ? `${TMDB_IMG}/w185${film.poster_path}` : undefined,
    externalUrl: `https://www.themoviedb.org/movie/${film.id}`,
    youtubeVideoId: trailer?.key,
    youtubeUrl: trailer ? `https://youtube.com/watch?v=${trailer.key}` : undefined,
    rating: film.vote_average,
    description: film.overview?.slice(0, 200),
    externalId: String(film.id),
  };
}

// TV uses /search/tv and /tv/{id} — same pattern, different endpoints
export async function enrichTV(node: TreeNode): Promise<EnrichedMedia> {
  // Same structure as enrichFilm but with /search/tv and /tv/{id}
  // ...
}
```

```typescript
// src/server/enrichment/music.ts
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
      )}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };
  return data.access_token;
}

export async function enrichAlbum(node: TreeNode): Promise<EnrichedMedia> {
  const token = await getSpotifyToken();
  const { title, creator } = node.searchHint;

  const query = `album:${title} artist:${creator}`;
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  const album = data.albums?.items?.[0];
  if (!album) return {};

  return {
    coverUrl: album.images?.[0]?.url,
    thumbnailUrl: album.images?.[2]?.url,
    spotifyUrl: album.external_urls?.spotify,
    externalUrl: album.external_urls?.spotify,
    externalId: album.id,
  };
}
```

Trailer data comes bundled with TMDB's film/TV enrichment via
`append_to_response=videos`. No separate YouTube API needed — the
trailer's YouTube video ID is embedded in the TMDB response, which
is how `youtubeVideoId` and `youtubeUrl` get populated above.

This saves a dedicated API integration and avoids YouTube's
restrictive 10,000-unit/day quota (100 units per search = just
100 searches/day on the free tier, a hard scaling ceiling).

### Phase 2 Enrichers: Places & Events (ready to plug in)

```typescript
// src/server/enrichment/wikipedia.ts
const WIKI_API = "https://en.wikipedia.org/api/rest_v1";

export async function enrichEvent(node: TreeNode): Promise<EnrichedMedia> {
  const slug = node.searchHint.wikiSlug;
  if (!slug) return enrichBySearch(node.searchHint.title);

  const res = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(slug)}`);
  if (!res.ok) return {};
  const data = await res.json();

  return {
    wikipediaUrl: data.content_urls?.desktop?.page,
    wikiExtract: data.extract?.slice(0, 300),
    thumbnailUrl: data.thumbnail?.source,
    coverUrl: data.originalimage?.source,
    description: data.description,
    eventDate: node.searchHint.dateRange?.start,
  };
}

// Reusable for article and person nodes in Phase 3
export async function enrichBySearch(title: string): Promise<EnrichedMedia> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(title)}&format=json&srlimit=1`,
  );
  const data = await res.json();
  const pageTitle = data.query?.search?.[0]?.title;
  if (!pageTitle) return {};

  const summaryRes = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(pageTitle)}`);
  const summary = await summaryRes.json();

  return {
    wikipediaUrl: summary.content_urls?.desktop?.page,
    wikiExtract: summary.extract?.slice(0, 300),
    thumbnailUrl: summary.thumbnail?.source,
    description: summary.description,
  };
}
```

```typescript
// src/server/enrichment/places.ts
const PLACES_BASE = "https://places.googleapis.com/v1/places";

export async function enrichPlace(node: TreeNode): Promise<EnrichedMedia> {
  const { title, location } = node.searchHint;

  const searchText = [title, location?.address, location?.city, location?.country]
    .filter(Boolean)
    .join(", ");

  const res = await fetch(`${PLACES_BASE}:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.location",
        "places.photos",
        "places.websiteUri",
        "places.businessStatus",
        "places.editorialSummary",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: searchText, maxResultCount: 1 }),
  });
  const data = await res.json();
  const place = data.places?.[0];

  if (!place) {
    // Place might not exist anymore (CBGB, etc.) — fall back to Wikipedia
    return enrichBySearch(title);
  }

  const statusMap: Record<string, string> = {
    OPERATIONAL: "open",
    CLOSED_TEMPORARILY: "closed",
    CLOSED_PERMANENTLY: "closed",
  };

  return {
    coordinates: place.location
      ? {
          lat: place.location.latitude,
          lng: place.location.longitude,
        }
      : undefined,
    googlePlaceId: place.id,
    externalUrl: place.websiteUri,
    description: place.editorialSummary?.text?.slice(0, 200),
    placeStatus: (statusMap[place.businessStatus] as any) || "historical",
  };
}
```

### The Orchestrator

```typescript
// src/server/enrichment/pipeline.ts
import type { CultureTree, TreeNode, EnrichedMedia } from "../../schemas";

type NodeWithId = TreeNode & { _id: string };

function flattenNodes(tree: CultureTree, parentId = "root"): NodeWithId[] {
  const nodes: NodeWithId[] = [];
  tree.children.forEach((child, i) => {
    const id = `${parentId}-${i}`;
    nodes.push({ ...child, _id: id });
    if (child.children?.length) {
      nodes.push(...flattenNodes({ ...child, children: child.children } as CultureTree, id));
    }
  });
  return nodes;
}

export async function enrichTree(tree: CultureTree): Promise<Map<string, EnrichedMedia>> {
  const nodes = flattenNodes(tree);
  const enrichments = new Map<string, EnrichedMedia>();

  const results = await Promise.allSettled(
    nodes.map(async (node) => {
      const enricher = getEnricher(node.type);
      if (!enricher) return { id: node._id, media: {} };
      const media = await enricher(node);
      return { id: node._id, media };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      enrichments.set(result.value.id, result.value.media);
    }
    // Failed enrichments silently skipped — node still renders
  }

  return enrichments;
}
```

### Combined Server Function

```typescript
// src/server/culture-tree.ts
import { createServerFn } from "@tanstack/react-start";
import { generateTree } from "./generate-tree";
import { enrichTree } from "./enrichment/pipeline";

export const createCultureTree = createServerFn({ method: "POST" })
  .validator(TreeRequestSchema)
  .handler(async ({ data }) => {
    const tree = await generateTree({ data });
    const enrichments = await enrichTree(tree);
    return { tree, enrichments: Object.fromEntries(enrichments) };
  });
```

---

## User Flows: Grow Branch & Add Node

Two flows that turn the tree from a static output into a living
thing the user shapes. Both are Phase 2 features but the schemas
and server functions are designed for them from day one.

### Flow 1: Grow This Branch

User clicks a node → AI generates 2-3 children for that node →
new nodes appear on the tree. The tree grows organically, guided
by the user's curiosity.

```
┌──────────────────┐     ┌───────────────────────┐     ┌─────────────┐
│  User clicks      │────▶│  AI generates 2-3     │────▶│ New children │
│  "Grow" on a node │     │  children, using full  │     │ added to     │
│                   │     │  tree as context (so   │     │ tree, marked │
│                   │     │  no repeats)           │     │ ai-expanded  │
└──────────────────┘     └───────────────────────┘     └─────────────┘
```

**Key details:**

- The AI receives the clicked node PLUS the full tree context so it
  doesn't repeat anything already in the tree.
- User-added nodes (`source: 'user'`) are treated as firm anchors —
  the AI builds around them, never second-guesses them.
- New nodes are marked `source: 'ai-expanded'`.
- Enrichment runs only on the new children, not the whole tree.
- This is a single Pass 1 call — cheap and fast.

**Server function:**

```typescript
// packages/engine/src/generation/expand.ts

export const ExpandNodeSchema = z.object({
  tree: CultureTreeSchema, // the full current tree (for context)
  targetNodeId: z.string(), // which node to expand
  count: z.number().default(3), // how many children to generate
});

export async function expandBranch(input: z.infer<typeof ExpandNodeSchema>) {
  const { tree, targetNodeId, count } = input;

  // Find the target node in the tree
  const targetNode = findNodeById(tree, targetNodeId);
  if (!targetNode) throw new Error("Node not found");

  // Serialize the existing tree so AI knows what's already covered
  const existingNames = flattenAll(tree).map((n) => n.name);

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    output: Output.object({
      schema: z.object({ children: z.array(TreeNodeSchema) }),
    }),
    system: SYSTEM_PROMPT,
    prompt: buildExpandPrompt(targetNode, existingNames, tree.name, count),
  });

  // Mark all new nodes as ai-expanded
  const children = result.object.children.map((child) => ({
    ...child,
    source: "ai-expanded" as const,
  }));

  return children;
}
```

**Expand prompt:**

```typescript
export function buildExpandPrompt(
  targetNode: TreeNode,
  existingNames: string[],
  rootQuery: string,
  count: number,
): string {
  return `You are expanding a culture tree that was originally generated
for "${rootQuery}".

The user wants to explore this node further:
  "${targetNode.name}" [${targetNode.type}]
  Connection: "${targetNode.reason}"

Generate ${count} children for this node. These should be deeper,
more obscure connections that branch out FROM this specific node,
not from the original query.

DO NOT recommend any of these works already in the tree:
${existingNames.map((n) => `- ${n}`).join("\n")}

Each child should have its own reason explaining why it connects
to "${targetNode.name}" specifically.`;
}
```

**Pricing:** Branch expansion does NOT count against the user's free
tree limit. You get 3 free seeds (initial generations). Growing
branches within those trees is unlimited on free tier. This is where
engagement lives — gating it would kill the product's stickiness.

---

### Flow 2: Add Node via Search

User adds a node manually by searching for a real work, place, or
event. Search-first means every node is a verified real thing with
enrichment data already attached.

```
┌────────────┐   ┌────────────┐   ┌──────────────┐   ┌────────────┐
│ User clicks │──▶│ Pick type  │──▶│ Search box   │──▶│ Pick from  │
│ "Add Node"  │   │ (book,     │   │ queries the  │   │ results    │
│             │   │  film,     │   │ right API    │   │ (with art) │
│             │   │  album,    │   │              │   │            │
│             │   │  place...) │   │              │   │            │
└────────────┘   └────────────┘   └──────────────┘   └────────────┘
                                                           │
                                                           ▼
                                                     ┌────────────┐
                                                     │ Write       │
                                                     │ reason for  │
                                                     │ connection  │
                                                     │             │
                                                     │ Pick parent │
                                                     │ node        │
                                                     │             │
                                                     │ Pick        │
                                                     │ connection  │
                                                     │ type        │
                                                     └─────┬──────┘
                                                           │
                                                           ▼
                                                     Node added to
                                                     tree, fully
                                                     enriched,
                                                     source: 'user'
```

**Why search-first, not freeform:**

1. Guarantees the node is a real thing — no typos or vague descriptions.
2. Enrichment data (cover art, links, metadata) comes back as part of
   the search results. No separate enrichment step needed.
3. Every node in a shared tree looks professional — real images,
   working links, correct metadata.

**Search routes by type:**

| Type selected | API searched        | Returns                                |
| ------------- | ------------------- | -------------------------------------- |
| book          | Google Books        | title, author, cover, ISBN             |
| album         | Spotify             | title, artist, album art, Spotify link |
| film          | TMDB                | title, year, poster, rating            |
| tv            | TMDB                | title, year, poster, rating            |
| place         | Google Places       | name, address, coordinates, photos     |
| event         | Wikipedia           | title, extract, thumbnail              |
| artist        | Spotify + Wikipedia | name, image, bio                       |

**Server function:**

```typescript
// apps/web/src/server/search.ts

export const SearchNodeSchema = z.object({
  query: z.string().min(1),
  type: NodeType,
});

export const searchForNode = createServerFn({ method: "GET" })
  .validator(SearchNodeSchema)
  .handler(async ({ data }) => {
    const { query, type } = data;

    switch (type) {
      case "book":
        return searchGoogleBooks(query); // returns title, author, cover, ISBN
      case "album":
        return searchSpotify(query); // returns title, artist, art, link
      case "film":
      case "tv":
        return searchTMDB(query, type); // returns title, year, poster
      case "place":
        return searchGooglePlaces(query); // returns name, address, coords
      case "event":
      case "person":
      case "article":
        return searchWikipedia(query); // returns title, extract, thumb
      default:
        return [];
    }
  });
```

Each search function returns results in a common shape:

```typescript
export const SearchResultSchema = z.object({
  name: z.string(),
  type: NodeType,
  year: z.number().optional(),
  searchHint: SearchHintSchema, // pre-filled for enrichment
  media: EnrichedMediaSchema, // cover art, links already attached
});
```

When the user picks a result, the client has everything it needs
to create the node — no extra API call. The user just adds their
reason and picks a parent node.

**The node is created client-side:**

```typescript
const newNode: TreeNode = {
  name: selectedResult.name,
  type: selectedResult.type,
  year: selectedResult.year,
  reason: userWrittenReason,
  connectionType: userSelectedConnectionType,
  searchHint: selectedResult.searchHint,
  source: "user",
  children: [],
};
```

**Optional AI-assisted reason:** If the user doesn't want to write
their own reason, they can click "suggest reason" and the AI will
generate one based on the parent node and the selected work. This
is a single cheap API call.

```typescript
export async function suggestReason(
  parentNode: TreeNode,
  childNode: { name: string; type: string },
): Promise<string> {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    prompt: `In 1-2 sentences, explain the cultural connection between
"${parentNode.name}" [${parentNode.type}] and
"${childNode.name}" [${childNode.type}].
Be specific and insightful, not generic.`,
  });
  return result.text;
}
```

---

## Phase 4: Client Receives Hydrated Tree

The client gets a `CultureTree` plus enrichments keyed by node ID.
React Flow renders rich nodes. Different node types get different
card layouts:

```
┌────────────────────────────────────────────────────────┐
│  🎬 FILM NODE                                          │
│  ┌──────┐                                              │
│  │poster│  Taxi Driver (1976)                          │
│  │      │  "Scorsese's fever dream of a collapsing     │
│  │      │   city — the grimy NY that actually existed"  │
│  └──────┘                                              │
│  ⭐ 8.2  🎬 TMDB  ▶️ Trailer           [birthplace]   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  📍 PLACE NODE                                P2       │
│  ┌──────┐                                              │
│  │photo │  CBGB — 315 Bowery, Manhattan                │
│  │      │  "The club where punk was born. Ramones,     │
│  │      │   Television, Blondie all played here."       │
│  └──────┘                                              │
│  🔴 Closed  📍 Map  🔗 Wikipedia       [frequented]   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  ⚡ EVENT NODE                                P2       │
│  ┌──────┐                                              │
│  │wiki  │  1977 New York City Blackout                 │
│  │thumb │  "25 hours of darkness that triggered        │
│  │      │   widespread looting and the birth of hip    │
│  │      │   hop in the South Bronx"                    │
│  └──────┘                                              │
│  📅 Jul 13, 1977  🔗 Wikipedia          [catalyst]    │
└────────────────────────────────────────────────────────┘
```

---

## Rate Limiting & API Resilience

At scale, the enrichment pipeline will hit API rate limits. One user
generating one tree is fine. A hundred users generating trees at once
is where things break — and not uniformly.

### Per-API Limits to Plan For

| API                     | Limit                            | Risk Level                                  |
| ----------------------- | -------------------------------- | ------------------------------------------- |
| Google Books            | 1,000/day unauth, 100/100s burst | Medium — burst limit matters for deep trees |
| TMDB                    | No hard limit (removed 2024)     | Low                                         |
| Spotify                 | 180 requests/minute (app-wide)   | High — shared pool across all users         |
| Wikipedia               | No practical limit               | Low                                         |
| Google Places (Phase 2) | Cost-limited, not rate-limited   | Cost risk, not rate risk                    |

### Defense Layers

**Layer 1: Enrichment cache (most important).** Every enricher checks
the Postgres cache before calling the API. Popular works — Taxi Driver,
Wise Blood, OK Computer — get cached on day one of production and
never hit the API again. Over time, cache hit rate climbs toward 90%+
for common recommendations. This is your single biggest defense.

**Layer 2: Per-API rate limiter.** Use [Bottleneck](https://www.npmjs.com/package/bottleneck)
to queue requests per API, so burst limits never trip. Configure
conservatively to leave headroom for concurrent users.

```typescript
// packages/engine/src/enrichment/limiters.ts
import Bottleneck from "bottleneck";

export const limiters = {
  googleBooks: new Bottleneck({
    reservoir: 90, // 90 calls allowed
    reservoirRefreshAmount: 90,
    reservoirRefreshInterval: 100 * 1000, // every 100s (burst limit)
    maxConcurrent: 10,
  }),

  spotify: new Bottleneck({
    reservoir: 150, // 150/min (leaves headroom under 180)
    reservoirRefreshAmount: 150,
    reservoirRefreshInterval: 60 * 1000,
    maxConcurrent: 5,
  }),

  tmdb: new Bottleneck({
    maxConcurrent: 10, // just concurrency control
  }),

  wikipedia: new Bottleneck({
    maxConcurrent: 5,
  }),

  googlePlaces: new Bottleneck({
    // Phase 2
    maxConcurrent: 5,
  }),
};
```

Each enricher wraps its fetch call in the appropriate limiter:

```typescript
// packages/engine/src/enrichment/books.ts
import { limiters } from "./limiters";

export async function enrichBook(node: TreeNode): Promise<EnrichedMedia> {
  // Check cache first
  const cached = await getCachedEnrichment(node.searchHint);
  if (cached) return cached;

  // Rate-limited API call
  const result = await limiters.googleBooks.schedule(() => fetchFromGoogleBooks(node.searchHint));

  if (Object.keys(result).length > 0) {
    await cacheEnrichment(node.searchHint, "book", result);
  }
  return result;
}
```

For production (multiple server instances), swap the in-memory
Bottleneck for a Redis-backed version. Same API, shared state
across instances.

**Layer 3: Graceful degradation.** If an API fails or rate-limits,
the node still renders — just without cover art or external links.
The `Promise.allSettled` pattern in the enrichment pipeline already
handles this: failed enrichments silently skip, the tree returns
with partial media data.

This is the critical UX point: **missing media must never break a
node**. A Spotify throttle means the album node shows the AI's text
content without an album cover. The recommendation itself is intact.
The UI is designed from day one to handle nodes with no media.

**Layer 4: Monitoring.** Log enrichment success rates per API.
Alert when cache hit rate drops below a threshold or when any API's
failure rate climbs. Track in the admin dashboard so you can see
problems before users do.

### Why No YouTube API

We deliberately do NOT use the YouTube Data API v3. Its free tier
is 10,000 units/day, and a single search costs 100 units — that's
just 100 searches per day across the entire application. A hard
scaling ceiling.

Instead, film and TV trailers come from TMDB's response via
`append_to_response=videos`. TMDB's video objects include the
YouTube video ID directly, so we can embed trailers and link to
YouTube without ever calling Google's API. Zero quota cost, same
result.

For Phase 2+ if we need YouTube content beyond trailers (music
videos, interviews, live performances), we'll reconsider — possibly
with a lazy-load pattern (fetch only when the user clicks to watch)
rather than enriching every node upfront.

---

## Caching Strategy

Caching is especially important with the multi-pass pipeline, where a
`deep` tree costs 3 Claude API calls. Identical queries should NEVER
re-generate.

| What               | Where                    | TTL     | Why                          |
| ------------------ | ------------------------ | ------- | ---------------------------- |
| Generated trees    | DB (per query hash)      | 7 days  | Avoid costly re-generation   |
| Pass 1 output      | DB (per query hash)      | 7 days  | Reuse if user upgrades depth |
| Enrichment data    | DB (per searchHint hash) | 30 days | API data is stable           |
| Spotify token      | In-memory                | ~55 min | Expires every 60 min         |
| Popular trees      | Edge/CDN                 | 1 hour  | Shared trees get traffic     |
| Wikipedia extracts | DB                       | 90 days | Content rarely changes       |
| Google Places data | DB                       | 30 days | Status may change            |

Query hash = `sha256(query + depth + mediaFilter + tone)`

Note: caching Pass 1 separately means if a user generates a `shallow`
tree and later wants `standard`, we can skip straight to Pass 2 using
the cached Pass 1 output.

---

## Environment Variables

The template already has `.env.example` files in `apps/web/` and
`packages/db/`. Add engine-specific vars to `apps/web/.env`:

```env
# Already from template:
DATABASE_URL=postgresql://user:pass@localhost:5432/culture_tree
BETTER_AUTH_SECRET=...

# Development — set 'true' for UI work, no API calls
MOCK_ENGINE=true

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Phase 1 APIs
TMDB_ACCESS_TOKEN=eyJ...           # provides film/TV data + embedded trailer IDs
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
GOOGLE_BOOKS_API_KEY=...           # optional, higher rate limits

# Phase 2 APIs
GOOGLE_PLACES_API_KEY=...
# Wikipedia REST API — no key required

# Database
DATABASE_URL=postgresql://...
```

---

## Development Cost Strategy

A deep tree is three Claude calls plus 15+ enrichment API calls.
Without a strategy, prompt iteration burns money fast. The rule:
**real Claude calls only happen when deliberately testing prompt
quality. Everything else uses fixtures or cache.** Most development
days should cost under $1.

### Fixtures

Generate 5-6 real trees once across different query types, save as
JSON, and use everywhere. One-time cost ~$0.50.

```
packages/engine/
├── fixtures/
│   ├── ok-computer-shallow.json
│   ├── ok-computer-standard.json
│   ├── ok-computer-deep.json
│   ├── grimy-new-york-70s-standard.json
│   ├── blood-meridian-standard.json
│   ├── nick-cave-boatmans-call-deep.json
│   └── david-lynch-standard.json
```

These fixtures are used by:

- All Vitest unit and integration tests
- UI development (rendering tree cards, layouts, loading states)
- Enrichment development (testing API mapping without regenerating)

### Mock Engine Flag

The web app's server function checks `MOCK_ENGINE`:

```typescript
// apps/web/src/server/culture-tree.ts
import { createServerFn } from "@tanstack/react-start";
import { generateTree, enrichTree } from "@repo/engine";
import { TreeRequestSchema } from "@repo/schemas";
import okComputerFixture from "@repo/engine/fixtures/ok-computer-standard.json";

export const createCultureTree = createServerFn({ method: "POST" })
  .validator(TreeRequestSchema)
  .handler(async ({ data }) => {
    // During UI development: return fixture instantly, no API calls
    if (process.env.MOCK_ENGINE === "true") {
      return {
        tree: okComputerFixture,
        enrichments: {}, // or load a cached enrichment fixture
      };
    }

    const tree = await generateTree(data);
    const enrichments = await enrichTree(tree);
    return { tree, enrichments: Object.fromEntries(enrichments) };
  });
```

90% of dev time is UI work. That's all free with `MOCK_ENGINE=true`.

### Fixture Loader (smarter version)

For a better dev experience, the mock can match the query to the
closest fixture:

```typescript
// packages/engine/src/fixtures/loader.ts
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { CultureTree } from "@repo/schemas";

const FIXTURE_DIR = join(__dirname, "../../fixtures");

const fixtures = new Map<string, CultureTree>();

// Load all fixtures into memory on startup
for (const file of readdirSync(FIXTURE_DIR)) {
  if (file.endsWith(".json")) {
    const data = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf-8"));
    fixtures.set(file.replace(".json", ""), data);
  }
}

export function getFixture(query: string, depth: string): CultureTree {
  // Try to find an exact match
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);
  const key = `${slug}-${depth}`;

  if (fixtures.has(key)) return fixtures.get(key)!;

  // Fall back to any fixture at the right depth
  for (const [k, v] of fixtures) {
    if (k.endsWith(`-${depth}`)) return v;
  }

  // Fall back to anything
  return fixtures.values().next().value!;
}
```

### Enrichment Cache (build first)

The enrichment cache in Postgres is not just for production — it's
your primary cost-saving tool during development. Build it before
anything else in the enrichment pipeline.

```typescript
// packages/engine/src/enrichment/cache.ts
import { db } from "@repo/db";
import { enrichmentCache } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { EnrichedMedia } from "@repo/schemas";

function hashSearchHint(hint: Record<string, any>): string {
  return createHash("sha256").update(JSON.stringify(hint)).digest("hex").slice(0, 16);
}

export async function getCachedEnrichment(
  searchHint: Record<string, any>,
): Promise<EnrichedMedia | null> {
  const hash = hashSearchHint(searchHint);
  const cached = await db.query.enrichmentCache.findFirst({
    where: eq(enrichmentCache.searchHintHash, hash),
  });

  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) return null;

  return cached.data as EnrichedMedia;
}

export async function cacheEnrichment(
  searchHint: Record<string, any>,
  nodeType: string,
  data: EnrichedMedia,
  ttlDays = 30,
): Promise<void> {
  const hash = hashSearchHint(searchHint);
  const expiresAt = new Date(Date.now() + ttlDays * 86400 * 1000);

  await db
    .insert(enrichmentCache)
    .values({
      id: hash,
      searchHintHash: hash,
      nodeType,
      data,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: enrichmentCache.searchHintHash,
      set: { data, expiresAt },
    });
}
```

Each enricher checks cache first, calls the API only on miss:

```typescript
// Pattern used in every enrichment function
export async function enrichBook(node: TreeNode): Promise<EnrichedMedia> {
  // 1. Check cache
  const cached = await getCachedEnrichment(node.searchHint);
  if (cached) return cached;

  // 2. Call API (only on cache miss)
  const result = await fetchFromGoogleBooks(node.searchHint);

  // 3. Cache for next time
  if (Object.keys(result).length > 0) {
    await cacheEnrichment(node.searchHint, "book", result);
  }

  return result;
}
```

After a few real runs, your local Postgres has cached enrichment
data for every work your test queries reference. Subsequent runs
are instant and free.

### Vitest: Mock AI SDK

Unit tests never call Claude. The Vercel AI SDK can be mocked:

```typescript
// packages/engine/src/__tests__/pipeline.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateTree } from "../generation/pipeline";
import okComputerFixture from "../../fixtures/ok-computer-standard.json";

// Mock the AI SDK's generateText
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    object: okComputerFixture,
  }),
  Output: {
    object: vi.fn().mockReturnValue({}),
  },
}));

describe("generateTree", () => {
  it("returns a valid tree for standard depth", async () => {
    const tree = await generateTree({
      query: "OK Computer — Radiohead",
      depth: "standard",
      tone: "mixed",
    });

    expect(tree.name).toBeDefined();
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it("calls generateText once for shallow depth", async () => {
    const { generateText } = await import("ai");
    await generateTree({ query: "test", depth: "shallow", tone: "mixed" });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("calls generateText twice for standard depth", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockClear();
    await generateTree({ query: "test", depth: "standard", tone: "mixed" });
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
```

### Cost Rules of Thumb

| Activity                     | Cost   | How often                         |
| ---------------------------- | ------ | --------------------------------- |
| UI development               | $0     | Daily (MOCK_ENGINE=true)          |
| Unit tests                   | $0     | Every commit (mocked AI SDK)      |
| Single prompt iteration      | ~$0.02 | A few times/day (Pass 1, shallow) |
| Full deep tree generation    | ~$0.15 | When validating prompt changes    |
| Enrichment (cache miss)      | ~$0.01 | First run only, then cached       |
| Enrichment (cache hit)       | $0     | Every subsequent run              |
| Single eval                  | ~$0.05 | A few times/day                   |
| Full batch eval (16 queries) | ~$0.80 | Weekly milestone checks           |
| Daily budget target          | < $1   | Most days                         |

### .env.local for development

```env
# Set to 'true' during UI development — no API calls
MOCK_ENGINE=true

# Set your daily budget in Anthropic dashboard: $5/day
ANTHROPIC_API_KEY=sk-ant-...

# All other keys as before
```

---

## Testing Strategy (Vitest)

### Unit Tests

- **Schema validation**: Malformed AI responses rejected. All node types
  parse correctly. Edge cases: missing searchHint fields, empty children,
  unknown connectionType values, place nodes without coordinates.
- **Enrichment functions**: Mock each API response. Verify correct field
  mapping. Verify graceful fallback when API returns no results. Test
  Wikipedia fallback for closed places.
- **Prompt builder**: All three pass builders produce correct prompts.
  Pass 2 correctly serialises the Pass 1 tree. Pass 3 extracts branch
  names. Tone and mediaFilter flags applied correctly.
- **Flatten/merge utilities**: Tree → flat array → back to tree with
  enrichments attached. No nodes lost.

### Integration Tests

- **Multi-pass pipeline** (with mocked AI): Verify Pass 1 output is fed
  into Pass 2 prompt. Verify depth='shallow' only calls once, 'standard'
  calls twice, 'deep' calls three times.
- **Full pipeline** (with mocked APIs): Input query → AI response (fixture)
  → enrichment → hydrated tree output. Verify the shape.
- **Error resilience**: One API fails, others still succeed. Tree returned
  with partial media data. If Pass 2 fails, fall back to Pass 1 output.
- **Mixed node types**: A "Grimy New York 70s" fixture with film, album,
  place, and event nodes all enrich correctly.

### Quality Tests

- **Few-shot examples are valid**: Parse all few-shot examples against the
  tree schema to ensure they're structurally correct.
- **No duplicate recommendations**: Verify Pass 2 doesn't re-recommend
  anything from Pass 1 (compare node names).
- **Obscurity gradient**: In deep trees, verify that depth-2 nodes are
  not the same well-known works as depth-1 nodes (heuristic: check
  against a "too obvious" blocklist per query category).

### Example Test

```typescript
// src/server/enrichment/__tests__/books.test.ts
import { describe, it, expect, vi } from "vitest";
import { enrichBook } from "../books";

describe("enrichBook", () => {
  it("returns cover URL and description for a valid book", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          items: [
            {
              volumeInfo: {
                imageLinks: {
                  thumbnail: "http://books.google.com/thumb?zoom=1",
                  smallThumbnail: "http://books.google.com/small",
                },
                infoLink: "http://books.google.com/info",
                description: "A novel about the American South...",
                averageRating: 4.2,
              },
            },
          ],
        }),
    });

    const result = await enrichBook({
      name: "Wise Blood — Flannery O'Connor",
      type: "book",
      reason: "test",
      connectionType: "thematic",
      searchHint: { title: "Wise Blood", creator: "Flannery O'Connor" },
      children: [],
    });

    expect(result.coverUrl).toContain("zoom=2");
    expect(result.description).toBeDefined();
    expect(result.rating).toBe(4.2);
  });

  it("returns empty object when no results found", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ items: [] }),
    });

    const result = await enrichBook({
      name: "Nonexistent Book",
      type: "book",
      reason: "test",
      connectionType: "thematic",
      searchHint: { title: "asdkjhasd", creator: "nobody" },
      children: [],
    });

    expect(result).toEqual({});
  });
});
```

---

## File Structure

Based on tanstarter-plus. See `culture-tree-monorepo.md` for full details.

Package scope is `@repo/` (from template convention).

```
culture-tree/
├── apps/
│   ├── web/                          ← TanStack Start (from template)
│   └── admin/                        ← later phase
├── packages/
│   ├── auth/                         ← Better Auth (from template)
│   ├── db/                           ← Drizzle + Postgres (from template)
│   │   └── src/schema/
│   │       ├── auth.schema.ts        ← from template
│   │       ├── trees.ts              ← ADD
│   │       ├── enrichments.ts        ← ADD
│   │       └── ratings.ts            ← ADD
│   ├── ui/                           ← shadcn/ui (from template)
│   ├── engine/                       ← ADD: AI generation + enrichment
│   │   ├── src/generation/
│   │   │   ├── pipeline.ts           ← multi-pass orchestrator
│   │   │   ├── expand.ts             ← "grow this branch" generation
│   │   │   └── prompts.ts            ← system prompt + few-shot
│   │   ├── src/enrichment/
│   │   │   ├── pipeline.ts           ← orchestrator + registry
│   │   │   ├── cache.ts              ← Postgres enrichment cache
│   │   │   ├── books.ts              ← P1
│   │   │   ├── films.ts              ← P1
│   │   │   ├── music.ts              ← P1
│   │   │   ├── wikipedia.ts          ← P2
│   │   │   └── places.ts             ← P2
│   │   └── fixtures/                 ← real trees, generated once
│   └── schemas/                      ← ADD: shared Zod types
│       └── src/
│           ├── tree.ts
│           ├── input.ts
│           ├── enrichment.ts
│           └── quality.ts
├── scripts/                          ← ADD: eval harness
│   ├── eval.ts
│   └── eval-batch.ts
├── tooling/tsconfig/                 ← from template
└── docker-compose.yml                ← from template (local Postgres)
```

---

## Monetisation

### Tier 1: Freemium Subscription (core revenue)

- **Free**: 3 seeds (initial tree generations) per month, shallow depth
  only, no sharing. But: branch expansion ("grow this branch") is
  UNLIMITED on free tier. Adding nodes via search is unlimited.
  This keeps users engaged — gating expansion would kill stickiness.
- **Pro ($8-12/month)**: Unlimited seeds, standard + deep depth,
  shareable trees, collaboration, fork other users' public trees
- Cost model works because seeds cost real money (AI calls). Branch
  expansion is a single cheap call. Manual nodes cost nothing (no AI).

### Tier 2: Affiliate Revenue (passive, scales with usage)

Every node is a purchasable thing. Structural advantage over most
AI products:

- Book nodes → Bookshop.org (~10% commission)
- Album nodes → Spotify / Bandcamp
- Film nodes → JustWatch affiliate program (streaming links)
- The affiliate link IS a feature, not an interruption. Users
  discovered something and want to consume it.

### Tier 3: Embeddable Trees (viral growth + revenue)

- Free embed: "Made with Culture Tree" watermark, links back
- Pro embed: clean, custom styling
- Publications tier: music blogs, book review sites, editorial
  teams pay monthly for branded embeds. A Pitchfork review with
  an embedded Culture Tree of an album's influences = real value.

### Tier 4: API Access (B2B)

- Streaming platforms, bookshops, record stores, editorial teams
- Usage-based pricing, per-tree generation
- The multi-pass quality pipeline becomes a moat

### Tier 5: Curated Collections (premium content)

- Partner with tastemakers: music journalists, film critics, authors
- "Nick Cave's Culture Tree" — curated by Cave himself
- Revenue share model (like Substack for cultural recommendations)

### Tier 6: Print / Physical

- High-resolution Culture Trees printed as posters
- A "David Bowie" tree with album art, film posters, book covers
  is genuinely attractive wall art (£15-25)
- Viral on social media, drives sign-ups

### Tier 7: Gift Trees

- "I made you a Culture Tree based on your favourite album"
- £3-5 for a gift-wrapped shareable version with custom message
- Low effort, high margin, inherently viral

### Priority Order

1. Freemium subscriptions + affiliate links (covers costs, grows with usage)
2. Embeddable trees (viral loop — every embed is marketing)
3. API access (long-term B2B play)
4. Everything else compounds over time
