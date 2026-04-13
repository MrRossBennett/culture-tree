# Culture Tree — Enrichment API Reference

**Not used:** Spotify Web API, YouTube Data API v3. **`album` / `song` nodes use Wikipedia** (same stack as people/artists). A **MusicBrainz + Cover Art** implementation lives in `packages/engine/src/enrichment/music.ts` for a future pipeline switch. Trailer `youtubeVideoId` / `youtubeUrl` on film/TV nodes come **only** from TMDB’s `videos` payload (embedded YouTube keys), not from Google.

## Node Type → API Mapping

| Node Type | API                | Auth                             | What It Returns                                                                 |
| --------- | ------------------ | -------------------------------- | ------------------------------------------------------------------------------- |
| `film`    | TMDB               | Bearer token (Read Access Token) | Poster, rating, description, trailer YouTube ID via `append_to_response=videos` |
| `tv`      | TMDB               | Bearer token (Read Access Token) | Poster, rating, description, trailer YouTube ID via `append_to_response=videos` |
| `book`    | Google Books       | None                             | Cover image, description, rating, info link                                     |
| `album`   | Wikipedia REST API | None                             | Article image, extract, link (search: title + creator + `album`)                |
| `song`    | Wikipedia REST API | None                             | Same pattern (`song` disambiguation in search)                                  |
| `artist`  | Wikipedia REST API | None                             | Photo, bio extract, Wikipedia link                                              |
| `person`  | Wikipedia REST API | None                             | Portrait, bio extract, Wikipedia link                                           |
| `artwork` | Wikipedia REST API | None                             | Image of the work, description, Wikipedia link                                  |
| `place`   | Phase 2 — not yet  | —                                | —                                                                               |
| `event`   | Phase 2 — not yet  | —                                | —                                                                               |
| `podcast` | Not yet            | —                                | —                                                                               |
| `article` | Not yet            | —                                | —                                                                               |

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

### MusicBrainz + Cover Art Archive (alternate for albums, songs — not default)

Implemented in `packages/engine/src/enrichment/music.ts`. To use it again, wire
`album` / `song` in `packages/engine/src/enrichment/pipeline.ts` to
`fetchAlbumEnrichment` / `fetchSongEnrichment` instead of Wikipedia.

**Step 1 — Search MusicBrainz:**

```
GET https://musicbrainz.org/ws/2/release/?query=artist:{creator}+release:{title}&fmt=json&limit=1
```

**Required header:**

```
User-Agent: CultureTree/0.1 (your@email.com)
```

**No API key required.**

**Step 2 — Get cover art:**

```
GET https://coverartarchive.org/release/{mbid}/front
```

This returns a 307 redirect to the actual image URL. Follow the
redirect or use the final URL as the `coverUrl`.

If the Cover Art Archive returns 404, the release has no cover art.
The node renders without an image — this is fine.

**For songs:** Search for the release (album) that contains the song,
since cover art is per-release not per-track. Use the artist name
and search for releases, then use the first result's MBID.

**Fields to extract:**

- MusicBrainz release ID → externalId
- Cover Art Archive URL → coverUrl
- `https://musicbrainz.org/release/{mbid}` → externalUrl

---

### Wikipedia REST API (artists, persons, artworks, albums, songs)

Album and song nodes use the same flow below; search adds a trailing `album` or `song`
unless `wikiSlug` is set.

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
  externalUrl?: string     // primary link (TMDB page, MusicBrainz, Google Books)
  wikipediaUrl?: string    // Wikipedia article
  youtubeVideoId?: string  // trailer video ID (from TMDB, not YouTube API)
  youtubeUrl?: string      // full YouTube URL

  // Metadata
  rating?: number          // TMDB score, Google Books rating
  description?: string     // short blurb (max 200-300 chars)
  externalId?: string      // TMDB ID, MusicBrainz ID, etc.
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

| API               | Limit                        | Approach                                   |
| ----------------- | ---------------------------- | ------------------------------------------ |
| TMDB              | No hard limit                | Concurrency control only (max 10 parallel) |
| Google Books      | 100 requests per 100 seconds | Bottleneck limiter, 90/100s reservoir      |
| MusicBrainz       | 1 request per second         | Bottleneck limiter, strict 1/s             |
| Cover Art Archive | No hard limit                | Concurrency control (max 5 parallel)       |
| Wikipedia         | No practical limit           | Concurrency control (max 5 parallel)       |

MusicBrainz is the strictest — they enforce 1 request per second
per application. The Bottleneck limiter must respect this. All other
APIs are generous enough that concurrency control is sufficient.

---

## Environment Variables

```env
# Required
TMDB_ACCESS_TOKEN=eyJ...     # TMDB Read Access Token (Bearer)

# Optional (not needed for Phase 1)
GOOGLE_BOOKS_API_KEY=...     # only if you hit 1,000/day unauthenticated limit

# No keys needed for:
# - Google Books (works without key)
# - MusicBrainz (open, just needs User-Agent)
# - Cover Art Archive (fully open)
# - Wikipedia (fully open)
```
