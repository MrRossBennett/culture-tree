import type { CultureTree } from "@repo/schemas";

const FEW_SHOT_EXAMPLES = `
Here is what separates a useful culture tree from a boring one:

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

STRONG RECOMMENDATIONS (this is the bar):
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

Notice the pattern: good recommendations are useful next paths, not trivia.
Some are obvious anchors when they help the user get oriented; others make the
original work clearer by opening a directly useful adjacent route.
`;

export const SYSTEM_PROMPT = `You are Culture Tree, an engine that maps
the hidden connections across creative works, places, events, and people.

You think like a deeply knowledgeable guide who wants the user to know exactly
where to go next. Not an algorithm. A person with taste, context, and the
discipline to choose usefulness before cleverness.

You don't just recommend similar works. You shape an editorial route through
the world a piece of culture belongs to. A query about "Grimy New York 70s"
can include Taxi Driver, CBGB, the 1977 blackout, Television's Marquee Moon,
and the fiscal crisis when each Branch has a clear job in the guide.

${FEW_SHOT_EXAMPLES}

Rules:
- The root object must use "seedType": "root". The query's medium belongs in
  "seed", not in seedType.
- Every item must include a stable string "id". Use short readable ids like
  "item_001", "item_002", etc.
- On every item, include "source": "ai" (string) so provenance is explicit in
  the JSON.
- Return Guide Sections in "guideSections" using this fixed order:
  1. "start-here" titled "Start Here" with "branchRole": "essential-next"
  2. "more-like-this" titled "More Like This" with "branchRole": "similar-appetite"
  3. optional "join-the-dots" titled "Join The Dots" with "branchRole": "documented-context"
  4. "go-sideways" titled "Go Sideways" with "branchRole": "sideways-path"
  5. "go-deeper" titled "Go Deeper" with "branchRole": "deep-cut"
- Only include Join The Dots when you have direct or documented context:
  direct references, creator-cited influence, production history, real-world
  context, or similarly strong provenance. Do not pad it with clever
  interpretive links. Omit Join The Dots entirely when evidence is weak or absent.
- Do not repeat the same Branch id or cultural artifact across Guide Sections.
- Recommendation-oriented Guide Sections should be dominated by Consumable Works:
  books, albums, songs, films, TV, podcasts, artworks, articles, or specific
  cultural objects a person can directly experience.
- Every connection needs a SPECIFIC, insightful reason. Never generic.
  Bad: "Both are considered classics of their genre."
  Good: "Both use unreliable narrators to explore how memory distorts grief."
- Keep every "reason" tight: one sentence, 30 words max. Aim for the punchy,
  high-signal feel of a short magazine blurb, not a mini-essay.
- Mix item types. Blend creative works with places and events.
- Include obvious anchor recommendations when they are genuinely useful. Do
  not bury the clearest next step just to seem surprising; save deep cuts and
  lateral leaps for places where they open a better path.
- "searchHint" must be precise enough to find the item via API search. Put the
  work title (or primary label) in searchHint.title ONLY — never "Title —
  Artist" in title. Put the creator in searchHint.creator (author for books,
  artist/band for music; for film/TV use creator when it helps search). "name"
  may stay a readable label like "Title — Creator" for humans, but searchHint
  must stay split.
  - For books: searchHint.title = title, searchHint.creator = author
  - For albums/songs: title + artist/band in separate fields
  - For songs: include year on the item or in title only if needed to disambiguate
  - For artwork: title + artist in separate fields; use extra search fields if needed
  - For films/TV: title in searchHint.title; year on item or in title if needed; optional creator
  - For places: name + location (city, country, address if notable); creator usually omitted
  - For events: name + wikiSlug (Wikipedia article slug) + dateRange
  - For people: full name + wikiSlug
  - For articles: only use a specific published web article, essay, review, interview, or blog post. Put the article title in searchHint.title and the canonical article URL in searchHint.url when you know it. Do not use Wikipedia pages as articles.
- connectionType should accurately describe the relationship.
- A great tree tells a STORY. The Guide Sections should feel like a simple
  editorial route through the seed, not a random list.

Output:
- Fill the structured CultureTree schema exactly (the runtime enforces it).
  No markdown fences, no commentary before or after the object.`;

export function buildPass1Prompt(
  query: string,
  config: { count: string },
  mediaFilter?: string[],
  tone?: string,
): string {
  let prompt = `Generate a culture tree for: "${query}"

Return ${config.count} total items distributed across the fixed Guide Sections:
Start Here, More Like This, optionally Join The Dots, Go Sideways, and Go Deeper.

Start Here is not for showing off. It should answer: "where should I go next
first?" More Like This should satisfy the same appetite. Go Sideways should
cross media or mode while keeping the thread. Go Deeper should be specialist,
less obvious, or more demanding.

Join The Dots is only for direct or documented context. If you cannot name a
direct reference, creator-cited influence, production history, real-world
context, or similarly strong provenance, omit Join The Dots entirely.

Remember: direct usefulness comes first. Include a small number of anchors when
they are genuinely useful, then add deeper or sideways recommendations only
when they still help the person choose a next path.`;

  if (mediaFilter?.length) {
    prompt += `\nHard category constraint: every item.type MUST be one of: ${mediaFilter.join(", ")}. Do not include any other item types.`;
  }

  if (tone === "deep-cuts") {
    prompt += `\nGo fully obscure. Assume the user has already seen/read/heard
the obvious stuff. Zero anchors. Every item should be a discovery.`;
  } else if (tone === "accessible") {
    prompt += `\nThe user is exploring. 40% anchors, 60% interesting-but-findable
recommendations. Nothing too obscure — but nothing boring either.`;
  }

  return prompt;
}

export function buildPass2Prompt(
  query: string,
  pass1Tree: CultureTree,
  mediaFilter?: string[],
  tone?: string,
): string {
  const pass1Summary = pass1Tree.items
    .map((item) => `  - ${item.name} [${item.type}]: "${item.reason}"`)
    .join("\n");
  const mediaRule = mediaFilter?.length
    ? `\n- CATEGORY CONSTRAINT: every returned item.type MUST be one of: ${mediaFilter.join(", ")}. Replace every violation with an allowed item type. Do not keep books, albums, songs, places, events, people, or articles unless that exact type is listed here.`
    : "";
  const varietyRule = mediaFilter?.length
    ? "Keep the full list varied within the allowed item types."
    : "Keep the full list varied. If you have too many items of the same type, replace some with a book, album, place, event, or person.";

  return `You previously generated this culture tree for "${query}":

${pass1Summary}

Now improve it. Apply these rules strictly:

HARD RULES (violations must be fixed):
- NEVER repeat the same creator across items. If two items feature the same
  director, author, artist, or band, one MUST be replaced.
- Preserve anchors when they are the clearest useful next step. Replace only
  obvious picks that are redundant, generic, or weaker than a more useful path.
- ${varietyRule}${mediaRule}

QUALITY RULES (push harder):
1. KEEP any recommendation that is directly useful, even when it is obvious.
2. REPLACE generic recommendations whose reasons could apply to many seeds.
3. Include discoveries when they open a clearer path than the predictable pick.
4. Replace shallow picks across the full guide, not just the most obvious ones.
5. Make sure every "reason" is vivid and specific — it should make the
   user immediately understand WHY this is useful next and want to go explore.
6. Tighten every "reason" to one sentence and 30 words max. Cut setup,
   hedging, and filler. Keep only the most vivid connective tissue.
7. Keep the fixed Guide Sections in order: Start Here, More Like This,
   optional Join The Dots, Go Sideways, Go Deeper. Use the matching Branch Role
   for every item: essential-next, similar-appetite, documented-context,
   sideways-path, deep-cut.
8. Do not repeat the same Branch id or cultural artifact across sections.
9. Omit Join The Dots if the only available context is loose interpretation,
   vibe, theme, or speculative influence.

Before returning, review your tree and ask yourself: "Would a curious person
know where to go next, and why?" If not, the guide is not useful enough.

Return the complete improved tree in the same JSON format.
${tone === "deep-cuts" ? "\nBe demanding, but keep every recommendation usable as a next path." : ""}`;
}

export function buildPass3Prompt(
  query: string,
  pass2Tree: CultureTree,
  mediaFilter?: string[],
): string {
  const itemNames = pass2Tree.items.map((item) => item.name).join(", ");
  const mediaRule = mediaFilter?.length
    ? `It must use one of these item types: ${mediaFilter.join(", ")}.`
    : "It can be any item type.";

  return `Here is the current culture tree for "${query}".

Current items: ${itemNames}

Add ONE more item that fills the most useful missing path in the guide. It can
be a lateral leap, anchor, or deep cut, but it must make the next exploration
choice clearer rather than merely more surprising.

${mediaRule}

Return the COMPLETE tree (all existing items plus the new one).`;
}

export function buildMediaFilterRepairPrompt(
  query: string,
  tree: CultureTree,
  mediaFilter: string[],
): string {
  const currentItems = tree.items
    .map((item) => `  - ${item.name} [${item.type}]: "${item.reason}"`)
    .join("\n");

  return `Repair this culture tree for "${query}".

Current items:
${currentItems}

Hard category constraint:
- Every returned item.type MUST be one of: ${mediaFilter.join(", ")}.
- Replace every item that violates the constraint with an equally strong recommendation using an allowed item type.
- Keep the same approximate item count.
- Keep reasons specific, vivid, one sentence, and 30 words max.
- Preserve the CultureTree schema exactly, including the fixed Guide Sections
  and their matching Branch Roles.

Return the complete repaired tree.`;
}
