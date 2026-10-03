# GUIDANCE — default-flag

Append-only. Written for you by the coordinating session. Newest at the BOTTOM.

Read the tail of this file before starting new work, and again after writing a
REPORT entry that says BLOCKED_ON. If guidance here conflicts with CLAUDE.md or
the spec, the spec wins on scope and the newest guidance wins on sequencing —
say so in your next REPORT entry rather than silently choosing.

---

## 2026-10-03T23:42Z — guidance
Protocol is live. Append your current state to docs/REPORT.md, then carry on with
whatever is unblocked. Do not wait for a reply before doing unblocked work.

## 2026-10-03T23:48Z — guidance

Cross-project findings from the other four builds. These were paid for elsewhere — do
not rediscover them. If one contradicts what you observe, say so in your next REPORT entry.

**F1 Dotted document IDs are hidden from anonymous readers.** Use hyphens. The spec example would make the dataset invisible to judges.
**F3 A Deploy Studios token cannot import documents** (`permission create required`). Imports use the project Editor token, `SANITY_API_WRITE_TOKEN`.
**F5 The Sanity plan is a Growth TRIAL** — 10k documents, 2 datasets, 250k requests/month, and it expires. Record the expiry date; a judge opening the demo afterwards is a live failure mode.
**F18 TypeScript resolves to 7.0.2**, a new major. Confirm Next.js and Sanity tolerate it; pin to 5.x if not.
**F21 Pin a stable, dated, non-preview Gemini model.** `gemini-3.8-flash` reports its version as only `3.0`; `gemini-3.7-flash` gives `3.7-flash-08-2026`. Never pin `-preview`.
**F22 Listing models proves auth, not generation.** Quota and billing failures appear only on a real completion call.
**F24 Journal PDFs are copyrighted; agency metadata usually is not.** Cite paper numbers with table and page; never ingest their text.
**F26 Colour can carry meaning that text extraction destroys.** Check for colour, strikethrough or formatting semantics before trusting any conversion.
**F27 Long URLs do not survive chat paste.** Write them to a file and pass the path.
**F28 Recurring error class: two different measures of one entity, conflated.** best-track confused peak intensity with landfall intensity and discarded a valid example. When a source says "unchanged", check WHICH measure.
**F29 Row counts do not measure change** — splits, lumps and renames cancel. Diff by stable identifier. Watch for junk rows.
**F30 Check whether your premise is already solved upstream.** eBird silently re-maps records on taxonomy updates, which pre-empted part of split-decision and forced a reposition.
**F31 Enumerate every sheet in a workbook.** An agent derived a change set by hand after reading only sheet index 0, while the file contained an authoritative changes sheet.

Path One only — Sanity Context and Knowledge Bases:

**F6 Context needs an ORG token with Context Viewer.** Project tokens are rejected; symptom is `403 contextGrantRequired`. A grant displayed as `Viewer (project-name)` is project-scoped and will not work.
**F7 Endpoint mode is derived from sources.** Attaching a dataset silently ignores KB sources — KB and dataset must be separate endpoints.
**F8 Entries are never generated automatically.** Click Build entries every time, and wait for `Entries up to date`.
**F9 A URL source is a site crawl with no single-page option.** One page pulled 675 documents against a 150 cap. Download and upload as a File instead.
**F10 The 150-document cap is real** and enforced as a plan limit, though undocumented.
**F11 Entry paths are NOT stable across rebuilds.** Resolve at runtime; cite stable external sources in stored data, never KB paths.
**F12 KB prose contains factual errors** — four confirmed in best-track. Never display a number sourced from KB prose. The KB explains rules; the dataset supplies figures.
**F13 Conflict resolution offers only keep or accept.** The governing rule must live in the Purpose text, plus an entity-identity rule.
**F14 Sanity generated connect-snippet is wrong for KB endpoints** — it lists dataset-mode tools and the wrong token variable. Discover tools via `tools/list`.
**F15 `knowledge_base_search` is BM25 keyword search** and undocumented. If one evaluation arm is a keyword baseline, say where the KB advantage actually comes from.
**F2 `sanity schema deploy` is separate from deploying the Studio.** Context data mode needs a deployed schema, not a deployed Studio — the spec is wrong on this.
