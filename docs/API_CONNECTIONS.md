# Culture Tree — Enrichment API Reference

> **Update (2026-05-31): search and the canonical record are Wikidata-spined — see ADR 0004.**
> Every Branch's canonical record and notability ranking come from **Wikidata** (`wbsearchentities`
>
> - `wbgetentities`); the APIs below now act as **cover/media enrichers only**, keyed off IDs
>   carried on the Wikidata item. **Spotify and Google Books are removed.** MusicBrainz returns as
>   an _expansion_ source (a creator's studio discography) and as the key for Cover Art Archive.
>   The table below reflects the cover source per type; the older per-type "record" prose further
>   down predates the spine.

## Node Type → cover/media enricher

The record (name, type, year, creator, notability) always comes from Wikidata. This is the
**cover** source per type, with the Wikidata `P18` Commons image as the universal fallback:

| Node Type | Cover source                            | Key on Wikidata item            | Auth         |
| --------- | --------------------------------------- | ------------------------------- | ------------ |
| `film`    | TMDB poster                             | `P4947` (TMDB movie ID)         | Bearer token |
| `tv`      | TMDB poster                             | `P4983` (TMDB series ID)        | Bearer token |
| `book`    | Open Library cover                      | `P212`/`P957` ISBN, then `P648` | None         |
| `album`   | Cover Art Archive                       | `P436` (MusicBrainz RG ID)      | None         |
| `song`    | Wikidata `P18` (Commons)                | `P18`                           | None         |
| `artist`  | Wikidata `P18` (Commons)                | `P18`                           | None         |
| `person`  | Wikidata `P18` (Commons)                | `P18`                           | None         |
| `artwork` | Wikidata `P18` (Commons)                | `P18`                           | None         |
| `place`   | Deferred (not classified in search yet) | —                               | —            |
| `event`   | Deferred (not classified in search yet) | —                               | —            |
| `podcast` | Deferred                                | —                               | —            |
| `article` | Deferred                                | —                               | —            |

---

## API Details

### TMDB (films, tv)

**Search endpoint:**

```
GET https://api.themoviedb.org/3/search/movie?query={title}&year={year}
GET https://api.themoviedb.org/3/search/tv?query={title}
```

**Detail endpoint (includes trailers):**

```
GET https://api.themoviedb.org/3/movie/{id}?append_to_response=videos
GET https://api.themoviedb.org/3/tv/{id}?append_to_response=videos
```

**Auth (pick one):**

- **Read Access Token** (JWT from TMDB settings): header `Authorization: Bearer {TMDB_ACCESS_TOKEN}`
- **API Key** (v3): query param `api_key={TMDB_API_KEY}` on every request

Do not send the v3 API key as a Bearer token — TMDB returns `status_code` 7.

**Image base URL:**

```
Poster:    https://image.tmdb.org/t/p/w500{poster_path}
Thumbnail: https://image.tmdb.org/t/p/w185{poster_path}
```

**Trailer extraction:**
Find the first video where `type === 'Trailer'` and `site === 'YouTube'`.
The `key` field is the YouTube video ID.

**Search using:** `searchHint.title` + `year` query param. If the model puts the
year in the title (`… — 1968` or `… (1968)`), the enricher strips it and sets
`year` / `first_air_date_year` automatically when `node.year` is missing.

---

### Google Books (books)

**Search endpoint:**

```
GET https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=40
```

**Query construction:**

- If `searchHint.isbn` exists: `q=isbn:{isbn}`
- Otherwise: phrase match `q=intitle:"{title}"+inauthor:"{creator}"` (quoted segments)

The first API hit is often a secondary/commentary volume or a no-cover record.
The enricher scores candidates (title overlap, author match, penalties for long
derivative titles and patterns like “years later”, “medley of”, “reader’s guide”).
**If any result has cover thumbnails, only those are considered** so a real
edition (e.g. Penguin with art) can win over a metadata-only hit. Trailing
` — Author` is stripped from `title` when present. `externalUrl` uses the
volume `id` (`books.google.com/books?id=…`) when available.

**No cover from Google Books:** one follow-up call to Wikipedia (REST summary
search: title + author + `book`, or `wikiSlug` if set) fills `coverUrl` /
`thumbnailUrl` only; ratings, description, and Google Books link stay from
the Books API.

**No auth required.** No headers, no key.

**Cover image:**
Response includes `volumeInfo.imageLinks.thumbnail`. Replace `zoom=1`
with `zoom=2` in the URL for a larger image.

**Fields to extract:**

- `volumeInfo.imageLinks.thumbnail` → coverUrl
- `volumeInfo.imageLinks.smallThumbnail` → thumbnailUrl
- `volumeInfo.infoLink` → externalUrl
- `volumeInfo.description` → description (truncate to 200 chars)
- `volumeInfo.averageRating` → rating

---

### Wikipedia REST API (artists, persons, artworks, albums, songs, places, events)

Album and song nodes use the same flow below; search adds a trailing `album` or `song`
unless `wikiSlug` is set. Place search includes `searchHint.location`
fields when present. Event search includes `searchHint.dateRange.start`
and location fields when present.

**Direct lookup (if `searchHint.wikiSlug` exists):**

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{wikiSlug}
```

**Search fallback (if no wikiSlug):**

```
GET https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={title}&format=json&srlimit=1
```

Then take the page title from results and call the summary endpoint.

**No auth required.** No headers, no key.

**Fields to extract:**

- `thumbnail.source` → thumbnailUrl
- `originalimage.source` → coverUrl
- `content_urls.desktop.page` → wikipediaUrl
- `extract` → description (truncate to 300 chars)
- `description` → short description
- `coordinates.lat` / `coordinates.lon` → coordinates for place pages when present

---

## Enrichment Schema

Every enricher returns data matching this shape. All fields optional —
a node renders fine with none of them.

```typescript
{
  // Visual
  coverUrl?: string        // primary image (poster, cover, photo)
  thumbnailUrl?: string    // smaller version

  // Links
  externalUrl?: string     // primary link (TMDB page, Google Books, Wikipedia)
  wikipediaUrl?: string    // Wikipedia article
  youtubeVideoId?: string  // trailer video ID (from TMDB, not YouTube API)
  youtubeUrl?: string      // full YouTube URL

  // Metadata
  rating?: number          // TMDB score, Google Books rating
  description?: string     // short blurb (max 200-300 chars)
  externalId?: string      // TMDB ID, Google Books volume ID, etc.
}
```

---

## Cache Strategy

**Every enricher must check the Postgres cache before calling the API.**

Cache key: `sha256(JSON.stringify(searchHint))` truncated to 16 chars.

Cache TTL: 30 days.

Pattern for every enricher:

```
1. Hash the searchHint
2. Check enrichment_cache table for that hash
3. If found and not expired → return cached data
4. If not found → call API → cache result → return
```

This means each unique work is only looked up once in the lifetime
of the cache. Popular works (Taxi Driver, OK Computer) get cached
on first generation and never hit the API again.

---

## Rate Limiting

| API          | Limit                        | Approach                                   |
| ------------ | ---------------------------- | ------------------------------------------ |
| TMDB         | No hard limit                | Concurrency control only (max 10 parallel) |
| Google Books | 100 requests per 100 seconds | Bottleneck limiter, 90/100s reservoir      |
| Wikipedia    | No practical limit           | Concurrency control (max 5 parallel)       |

The active enrichment APIs are generous enough that Google Books burst limiting
and light concurrency control are sufficient.

---

## Environment Variables

```env
# Required
TMDB_ACCESS_TOKEN=eyJ...     # TMDB Read Access Token (Bearer)

# Optional (not needed for Phase 1)
GOOGLE_BOOKS_API_KEY=...     # only if you hit 1,000/day unauthenticated limit

# No keys needed for:
# - Google Books (works without key)
# - Wikipedia (fully open)
```
