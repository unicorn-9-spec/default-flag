# REPORT — default-flag

Append-only. You (the agent) write here. Newest entry at the BOTTOM.
Do not edit or delete earlier entries.

Entry format — copy this shape, with the heading at column zero:

```
    ## 2026-10-04T05:30Z — agent
    STATE: one line, what is true now
    BLOCKED_ON: none, or exactly what you need and from whom

    body: findings, decisions taken, questions, anything needing review
```

Write an entry whenever you finish a meaningful step, hit a blocker, make a
decision that departs from the spec, or need a judgement call.

Never inline long URLs, query strings or hashes — line wrapping destroys them.
Write them to a file and reference the path.

Entries begin below this line.

---

## 2026-10-03T23:50Z — agent
STATE: Build complete except the parts that need the data endpoint; CI is red on one checksum step; commit 57db37a is on main.
BLOCKED_ON: owner: (1) create Context endpoint `defaultflag-data` (dataset mode, `production`; currently HTTP 404); (2) decide on `ingest/data/raw/nea-docs/archive-dois.*` (listed in MANIFEST.tsv but uncommitted, so CI's checksum step fails); (3) Knowledge Base conflict screenshots.

Done (details in docs/BUILD_LOG.md §11–12):
- Dataset `production`: 380 docs, public read, hyphenated ids (F1), idempotent import using `SANITY_API_WRITE_TOKEN` (F3), schema deployed (F2).
- Physics + seeded Monte Carlo; 34 unit/offline-eval tests pass, including agreement with the archive's own insolation and Teq columns.
- Agent: Context tools via `tools/list` (prefixed `data_`/`kb_`), single-set `compute`, output guard that never takes numbers from KB results (F12).
- Site (`/`, `/planet/[slug]`, `/eval`, `/how-it-works`), Playwright + axe, four-arm eval harness, CI, README, `docs/POST_DRAFT.md`.

Next, unblocked:
- F21: check whether `gemini-3.8-flash` reports a dated version; switch the pin if not.
- F5: find the Growth trial expiry and record it.
- F15: state in the eval write-up that `knowledge_base_search` is itself BM25.

Decisions for review:
- Chip 1 is "Density of Kepler-139 d?" instead of K2-18 b (its composite equals its default, so the toggle would show nothing).
- Lead examples: Proxima Cen b (default refuses for lack of a radius; composite answers 5.49 g/cm³ from a calculated radius) and Kepler-139 d (5.29 vs 2.40).
- Values carrying a non-zero archive limit flag are refused, not computed.
- Earth density 5.514 is unconfirmed: the NASA fact sheet is unreachable from this machine.

## 2026-10-04T00:05Z — agent
STATE: F21 applied (model pin now gemini-3.7-flash, version recorded per run); F15 noted; everything else that remains needs the data endpoint.
BLOCKED_ON: owner: (1) create `defaultflag-data` (dataset mode, `production`); (2) decision on `nea-docs/archive-dois.*` (CI checksum step stays red until then); (3) Growth trial expiry date from Manage → Plan (not exposed by the project API); (4) KB conflict screenshots → `web/public/conflict/`.

- F21 confirmed independently: models.get gives version "3.0" for gemini-3.8-flash and "3.7-flash-08-2026" for gemini-3.7-flash. Switched; thinkingLevel 'low' works on 3.7.
- F5: tried the project API; no plan or trial field. Needs a human to read it.
- F15: written into BUILD_LOG §13 and the post draft. The structured arm's advantage is GROQ + single-set compute, not KB search.
- No finding in GUIDANCE contradicts what I observed.
- Once `defaultflag-data` exists I will, in order: probe it, run `eval/cache-chips.ts`, run the full 4-arm eval, commit results, and confirm CI e2e passes.

## 2026-10-04T00:45Z — agent
STATE: Guidance 00:18Z applied: archive-dois committed, TS 6.0.3, ups And c pinned as the compounding case, selection widened to 31 planets / 129 sets; CI build failure found and fixed locally.
BLOCKED_ON: owner: create `defaultflag-data` (dataset mode, `production`) — still HTTP 404; it gates cached chip answers, the full eval and the two remaining e2e tests. KB conflict screenshots still with the owner.

- After archive-dois was committed, CI passed checksums, determinism, typecheck, lint, tests, GROQ and the KB budget, then failed at `pnpm build`. Cause: Turbopack treats `new URL('../.env.local', import.meta.url)` as an asset; CI has no `.env.local`. Fixed (loadEnv moved to a script-only module) and verified by building with `.env.local` moved aside. CI result for this commit to follow in the next entry.
- The owner should add `archive-dois.html` to the Knowledge Base as a File source and rebuild entries (F8), since `kb/sources.json` now lists it. KB budget 68/150.
- ups And c: default refuses density (no radius); composite 13.19 g/cm³ from a calculated radius derived from the swapped mass. Labelled "compounding" in selection.json, README and post.
- 22 vs 30: widened cheaply to 31 planets; sets are 129 against the spec's ~90, and the reason is stated in README and post (the six spec-named planets alone carry 39 sets).
- The selection change added 124 documents (504 total, against a 10k plan cap per F5/F34, so no concern).

## 2026-10-04T01:30Z — agent
STATE: Demo live at default-flag.vercel.app (no login; all pages 200; asking shows the expected missing-endpoint banner). Everything except GitHub is prepared; commits are local only.
BLOCKED_ON: owner: (1) `defaultflag-data` endpoint (Context app UI only; there is no API or CLI for creating it); then `node scripts/finish.mjs` does the rest; (2) GitHub: remote returns "Repository not found" for the logged-in account; (3) KB: add the archive-dois file, set Purpose, Build entries, resolve one conflict with screenshots; (4) trial expiry; (5) video and agent session.

- Vercel project `default-flag` configured via REST (root `web`, Node 24.x, corepack for pnpm 12.8.1). Runtime env vars uploaded without printing; the Sanity write token is not uploaded.
- `scripts/finish.mjs`: one command after the endpoint exists (probe, cache chips, eval, tests, checks, deploy).
- `scripts/scan-secrets.mjs`: transcript scan before the agent session goes public; tracked files are clean.
- Step-by-step owner runbook in `docs/OWNER_STEPS.md`; video script in `docs/VIDEO_SCRIPT.md`.
- Honesty note for the KB criterion: resolving a conflict changes the KB explanation the agent quotes, not the computed number (numbers come only from the dataset). The runbook says to state this in the post.

## 2026-10-05T00:00Z — agent
STATE: `default-flag-data` endpoint live and connected; live agent answers end to end; full four-arm evaluation running now via scripts/finish.mjs.
BLOCKED_ON: none for the evaluation. Still owner: GitHub access, KB conflict + screenshots, trial expiry, video, agent session.

- **Finding that contradicts guidance F2:** the dataset endpoint stayed "Not ready — No Studio application found / no schema descriptor" after `sanity schema deploy`. A deployed Studio (`sanity deploy`, default-flag.sanity.studio) fixed it. Other Path One builds should deploy their Studio.
- **Endpoint names are auto-filled from the title** and immutable: ours is `default-flag-data`. Code updated.
- Fixed a guard false positive on "16th–84th" ordinals (tests added).

## 2026-10-05T00:10Z — agent
STATE: Eval run 2 done and live (structured 98%, 0% mixed, 5/5 refusals; baselines 3% mixed); KB rebuilt with planet entries; no conflict appeared in Issues, so the spec fallback is documented.
BLOCKED_ON: owner: GitHub access (all commits local); trial expiry; two fallback screenshots → web/public/conflict/; video; agent session.

- Finding for other Path One builds: **Context allows one source per dataset.** Combine document kinds in one GROQ query (a `select()` projection works) and give the preview rows a `title`.
- Finding: **a Purpose rule can pre-empt the Issues queue.** With a clear default-wins rule in the Purpose, the build wrote both values into separate labelled tables and raised no issue. If a build needs a visible Keep/Accept moment, the Purpose may have to be less prescriptive. I did not do that, because staging a conflict would be dishonest.
- Honest eval framing for the post: the structured agent's edge is refusals and default-set adherence, not a big mixing gap; the baselines' failure was a silent paper switch.
