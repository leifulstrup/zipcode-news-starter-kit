# Source Log — every source ever considered

**Append-only.** This is the discovery history behind `sources-ranked.md`: every
source ever found, suggested, or stumbled on gets an entry here — **including the
rejected ones**, which stay with their reasons so they are never re-proposed cold.
`sources-ranked.md` holds the current roster; this file never forgets.

Entries are written by `/find-sources` and `/add-source` only. The writing model
may flag a candidate in its end-of-run report; it never writes here. Later status
changes (a source dies, a rejection is reconsidered, a probe starts failing) are
**appended** as dated notes under the original entry — never edited into it.

Reader-suggested sources: log the suggestion, never the suggester. No reader
identity in this file, ever.

## Entry format

```
### YYYY-MM-DD · <host or name> — <adopted | rejected | watch>

- **How found:** search sweep | user suggestion | reader suggestion | weekly-research flag
- **What it is:** one plain sentence.
- **Assessment:** coverage (does it cover this ZIP/jurisdiction), cadence (how often
  it updates, newest record seen), reliability notes, access shape (API/CSV/HTML),
  overlaps/shared origin with existing sources.
- **Jurisdiction confirmed by:** how identity was verified (the Springfield problem —
  a name match is not confirmation). e.g. "portal footer names Hamilton County, OH;
  test query returned streets inside the ZIP".
- **Live test:** what was fetched and what came back (or "not testable — static page").
- **Publisher verdict:** adopted (tier N, class P/IP/S) | rejected — their stated
  reason | watch — what would change the answer.
```

### Status-change note format

```
- **YYYY-MM-DD update:** what changed (probe failing since…, reconsidered because…,
  retired because…). New verdict if any.
```

---

## The log

_(no entries yet — `/find-sources` writes the first ones)_
