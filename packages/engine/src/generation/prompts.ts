import type { CultureTree } from "@repo/schemas";

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
- The root object must use "seedType": "root". The query's medium belongs in
  "seed", not in seedType.
- Every item must include a stable string "id". Use short readable ids like
  "item_001", "item_002", etc.
- On every item, include "source": "ai" (string) so provenance is explicit in
  the JSON.
- Every connection needs a SPECIFIC, insightful reason. Never generic.
  Bad: "Both are considered classics of their genre."
  Good: "Both use unreliable narrators to explore how memory distorts grief."
- Keep every "reason" tight: one sentence, 30 words max. Aim for the punchy,
  high-signal feel of a short magazine blurb, not a mini-essay.
- Mix item types. Blend creative works with places and events.
- Include 1-2 "anchor" recommendations that most knowledgeable people would
  agree with, but make the rest surprising. The ratio is: 20% anchors,
  80% deep cuts and lateral leaps.
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
  - For articles: one-off written piece (essay, feature, famous blog post) — searchHint.title + wikiSlug or URL
- connectionType should accurately describe the relationship.
- A great tree tells a STORY. The items should feel like a curated exhibition,
  not a random list.

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

Return ${config.count} items in a single flat list.

Remember: 20% anchors (the connections an expert would expect), 80% deep cuts
and lateral leaps (the connections that surprise even an expert).`;

  if (mediaFilter?.length) {
    prompt += `\nOnly include these item types: ${mediaFilter.join(", ")}`;
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

export function buildPass2Prompt(query: string, pass1Tree: CultureTree, tone?: string): string {
  const pass1Summary = pass1Tree.items
    .map((item) => `  - ${item.name} [${item.type}]: "${item.reason}"`)
    .join("\n");

  return `You previously generated this culture tree for "${query}":

${pass1Summary}

Now improve it. Apply these rules strictly:

HARD RULES (violations must be fixed):
- NEVER repeat the same creator across items. If two items feature the same
  director, author, artist, or band, one MUST be replaced.
- Maximum 1-2 anchors (recommendations most knowledgeable people would name).
  Count how many items are "obvious" — if more than 2 are, replace the weakest ones.
- Keep the full list varied. If you have too many items of the same type,
  replace some with a book, album, place, event, or person.

QUALITY RULES (push harder):
1. KEEP any recommendation that is genuinely surprising or insightful.
2. REPLACE any recommendation that would appear in the first page of
   a Google search for "${query}". Those are too obvious.
3. At least one item must be something the user has almost certainly
   never heard of — a genuine discovery.
4. Replace shallow picks across the full flat list, not just the most obvious ones.
5. Make sure every "reason" is vivid and specific — it should make the
   user immediately understand WHY these two things are connected and
   want to go explore.
6. Tighten every "reason" to one sentence and 30 words max. Cut setup,
   hedging, and filler. Keep only the most vivid connective tissue.

Before returning, review your tree and ask yourself: "Would a deeply
knowledgeable person be surprised and delighted by at least 4 of
these items?" If not, you haven't pushed far enough.

Return the complete improved tree in the same JSON format.
${tone === "deep-cuts" ? '\nBe ruthless. If a recommendation would appear in a typical "if you liked X" list, replace it.' : ""}`;
}

export function buildPass3Prompt(query: string, pass2Tree: CultureTree): string {
  const itemNames = pass2Tree.items.map((item) => item.name).join(", ");

  return `Here is the current culture tree for "${query}".

Current items: ${itemNames}

Add ONE more item that is a genuine lateral leap — something that connects to
the original query in a way that none of the existing items cover. This should
be the recommendation that makes someone screenshot the tree and share it
because it's so unexpected yet perfect.

It can be any item type.

Return the COMPLETE tree (all existing items plus the new one).`;
}
