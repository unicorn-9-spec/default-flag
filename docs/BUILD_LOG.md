# Build log — Default Flag (Path One)

Running log for the DEV post: prompts that worked, prompts that failed, where we got stuck, how we fixed it, what we cut. Newest entries at the bottom of each day.

## 2026-10-03 — Day 0: verification pass

Agent: Claude Code (claude-opus-5-5). Prompt that started the session (worked well — explicit ordering plus "stop and report"):

> Read CLAUDE.md and the spec in full. Then: 1) verify GEMINI_API_KEY with one cheap call, stop if it fails; 2) confirm every "Verify" item against live docs, write findings to docs/BUILD_LOG.md; 3) scaffold the pnpm workspace. Stop and report before feature code.

### 1. Gemini key — PASS

- One call: `GET https://generativelanguage.googleapis.com/v1beta/models` with header `x-goog-api-key`. **HTTP 200.** The key's unusual format authenticates fine.
- That only proves auth, not generation quota. The first real `generateContent` call will confirm quota.
- Text-generation models listed by the API today (selection): `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`, plus `*-latest` aliases.
- **Decision (pending):** pin one explicit versioned ID for every eval arm (no `-latest` alias, since aliases move). Candidate: `gemini-3.8-flash`.
- AI SDK provider package: **`@ai-sdk/google`** (v4.0.87). Its default env var is `GOOGLE_GENERATIVE_AI_API_KEY`, **not** `GEMINI_API_KEY`. So we pass `apiKey: process.env.GEMINI_API_KEY` explicitly via `createGoogleGenerativeAI`. Source: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
- MCP client: `import { createMCPClient } from '@ai-sdk/mcp'` (v2.0.66), transport `{ type: 'http', url, headers }`, discovery via `await client.tools()`. Source: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools

### 2. Sanity Context / Knowledge Bases — checked against live docs

| Item | Spec / sibling claim | Live docs say | Status |
| --- | --- | --- | --- |
| Endpoint URL | `https://api.sanity.io/v1/context/organizations/<orgId>/mcp/<endpointName>` | Same. Auth: `Authorization: Bearer <org token>`, an **organization** token with **Context Viewer** permission | ✅ confirmed |
| One mode per endpoint | Dataset wins if both attached | "if you attach both a dataset source and Knowledge Base sources, the dataset source wins and the Knowledge Base sources are ignored." Mode is derived from the sources | ✅ confirmed → two endpoints |
| KB mode via query params | — | `mode=knowledge_base` and `knowledgeBases=<kb id>` switch an endpoint to KB mode. KB ids begin with `kb` | ℹ️ new, noted |
| Data-mode prerequisite | Spec: deployed Studio. Sibling: deployed schema | "needs a deployed schema … run `sanity schema deploy` from a Studio on v5.1.0 or later" | ✅ **spec wrong, sibling right.** `sanity deploy` is still useful for a hosted Studio, but it is not the requirement |
| Tool names | Spec: `initial_context`, `groq_query`, `knowledge_base_read` | Tools page: GROQ mode = `initial_context`, `schema_explorer`, `groq_query`, `array_field_reader`. KB mode = `initial_context`, `knowledge_base_read` (≤20 paths per call). The *Configure an MCP* page still lists only two GROQ tools, so **the docs disagree with each other** | ✅ sibling right. We discover via `tools/list` at runtime and log the names |
| KB 150-doc cap | Spec: 150 | Not stated on the create-KB or retrieval-modes pages | ⚠️ undocumented. Keep 150 budget + CI check anyway |
| KB beta / enablement | — | "opt-in beta feature"; an **org admin** enables it on the **Labs** page under Manage; Context must be enabled for the org | ✅ confirmed |
| KB sources | Spec: GROQ queries + web pages | Add source → **Dataset**, **Website**, or **Files** | ✅ compatible with the plan |
| Conflict resolution | Spec: "standing instruction" typed in | Conflicts offer only **Keep the current entry** / **Accept the incoming claim** → **Resolve issue**. Other issue types: Apply / Dismiss / Edit manually. The resolution is "Saved as an instruction that shapes your content on the next rebuild." No free-text instruction box. KB has a **Purpose** field (1–2 sentences) that steers the build | ✅ **spec needs adapting:** put "default parameter set governs derived quantities; composite values are for population plots only" in the KB **Purpose**, then pick Keep/Accept deliberately per conflict |
| Public query API version | `v2025-02-19` | "Any past or present date is valid"; docs recommend pinning the date you start. Example uses `v2026-06-24` | ✅ valid. **Decision:** pin `v2026-10-03` (today) |
| Studio Node requirement | Node 22.12+ | `sanity@6.17.0` `engines.node: ">=22.12"` | ✅ confirmed (local Node v24.12.0) |

Sources: https://www.sanity.io/docs/ai/sanity-context-mcp · https://www.sanity.io/docs/ai/sanity-context-mcp-tools · https://www.sanity.io/docs/ai/sanity-context-configure-mcp · https://www.sanity.io/docs/ai/sanity-context-retrieval-modes · https://www.sanity.io/docs/ai/sanity-context-create-knowledge-base · https://www.sanity.io/docs/ai/sanity-context-resolve-issues · https://www.sanity.io/docs/content-lake/api-versioning

### 3. NASA Exoplanet Archive — checked against live docs and TAP

**Columns (`ps`)** — confirmed at https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html:
`pl_name`, `hostname`, `default_flag`, `pl_refname`, **`st_refname`** (separate stellar reference column; exists), **`pl_bmassprov`** (values: `Mass`, `M*sin(i)/sin(i)`, `Msini`), `pl_rade`/`err1`/`err2`, `pl_bmasse`/`err1`/`err2`, `pl_orbsmax`/`err1`/`err2`, `st_rad`/`err1`/`err2`, `st_teff`/`err1`/`err2`, `st_mass`/`err1`/`err2`, `pl_insol`, `pl_eqt`. The spec's example TAP query columns are all valid.

**Columns (`pscomppars`)** — the HTML column page is marked "deprecated, and completely obsolete", so we read **`TAP_SCHEMA.columns`** directly (authoritative). Per-parameter reference columns are `<param>_reflink`: `pl_rade_reflink`, `pl_bmasse_reflink`, `pl_orbsmax_reflink`, `st_rad_reflink`, `st_teff_reflink`, `st_mass_reflink`, `pl_insol_reflink`, `pl_eqt_reflink`, `pl_dens_reflink`, … plus `pl_bmassprov` and `disc_refname`. There is no `pl_refname` in pscomppars.

**Reference strings** are HTML anchors, e.g. `<a refstr=FARIA_ET_AL__2022 href=https://ui.adsabs.harvard.edu/abs/2022A&A...658A.115F/abstract target=ref>Faria et al. 2022</a>`, with HTML entities in names (`Su&aacute;rez Mascare&ntilde;o`). The normaliser must parse `refstr`, `href` (bibcode is in the ADS path) and the decoded text. Composite reflinks can be the literal `Calculated Value`.

**Proxima Cen b** — ✅ confirmed: all 5 `ps` rows have null `pl_rade`. The default row is Suárez Mascareño et al. 2025: Msini = 1.055 M⊕, a = 0.04848 AU. A good refusal case.

**How the composite is built** (https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html): per parameter, (1) use the **default reference's value if it exists**; (2) else the value with the smallest absolute uncertainty; (3) ties go to the most recent publication. Values "may not be internally or physically self-consistent".

#### ⚠️ STUCK / spec premise fails on real data

Measured on the live archive today (6,375 planets, default `ps` rows vs `pscomppars`; throwaway comparison, not yet the committed snapshot):

| Check | Result |
| --- | --- |
| Radius differs between default and composite (both non-null) | **0 planets** |
| Mass differs (both non-null) | 100 planets, 76 by >1σ. Mostly a default `Msini` replaced by a true mass from another paper (e.g. HD 10180 c: 13.2 → 2741.6 M⊕, Kiefer et al. 2021) |
| Default radius null, composite supplies one | **1,573 planets** |
| Composite density inputs drawn from >1 reference | 4,729, of which 4,504 involve `Calculated Value` |
| Composite insolation inputs (a, R★, Teff) from >1 reference | 2,423, but **0** where the default row was complete (identical values) |
| Rocky-threshold (1.6 R⊕) flips via radius | **0** |
| Density differs >20% where the default has both R and M | 1 (Kepler-139 d: 5.27 vs 2.26 g/cm³) |

Named planets: K2-18 b, TRAPPIST-1 e and LHS 1140 b have **identical** default and composite R and M. TOI-700 d and Kepler-452 b have a null default mass, which the composite fills with `Calculated Value` (1.58 and 3.29 M⊕). Proxima Cen b has a null default radius, which the composite fills with 1.02 R⊕ (`Calculated Value`).

**Consequence:** because of rule (1), the composite *never* contradicts a default value. It only **fills gaps** (often with a mass–radius-relation value) or swaps in a value where the default parameter is absent. The spec's "Expected conflict" (composite radius ≠ default radius) and "15–20 planets differing by >1σ in radius or mass" selection rule don't hold as written. The real story is: *where the default set refuses ("no measured radius"), the composite quietly answers with a calculated value from a different paper.* Proxima Cen b, TOI-700 d and Kepler-452 b are the natural demos; the K2-18 b chip shows no difference. **Needs an owner decision before select.ts is written.**

#### Other data caveats found

- **TRAPPIST-1 Teff = 2566 K** in its default row. Kopparapu 2014 coefficients are valid for **2600–7200 K**, so the "Is TRAPPIST-1 e in the HZ?" chip extrapolates outside the fit. Must be disclosed (or refused) in the answer.
- **TOI-700 d** default row has null `st_teff`, so insolation and HZ for TOI-700 d need a refusal under single-set rules.

### 4. Habitable zone and threshold sources

**Kopparapu et al. 2014**, arXiv:1404.5292v2 (12 May 2014), *ApJL* 787, L29. Table 1 read from the arXiv PDF text. Eq. (4): S_eff = S_eff⊙ + aT★ + bT★² + cT★³ + dT★⁴, with T★ = Teff − 5780 K. Valid for 2600 K ≤ Teff ≤ 7200 K, 0.1–5 M⊕.

| Limit | S_eff⊙ | a | b | c | d |
| --- | --- | --- | --- | --- | --- |
| Recent Venus | 1.776 | 2.136e-4 | 2.533e-8 | −1.332e-11 | −3.097e-15 |
| Runaway Greenhouse (1 M⊕) | 1.107 | 1.332e-4 | 1.58e-8 | −8.308e-12 | −1.931e-15 |
| Runaway Greenhouse (5 M⊕) | 1.188 | 1.433e-4 | 1.707e-8 | −8.968e-12 | −2.084e-15 |
| Runaway Greenhouse (0.1 M⊕) | 0.99 | 1.209e-4 | 1.404e-8 | −7.418e-12 | −1.713e-15 |
| Maximum Greenhouse | 0.356 | 6.171e-5 | 1.698e-9 | −3.198e-12 | −5.575e-16 |
| Early Mars | 0.32 | 5.547e-5 | 1.526e-9 | −2.874e-12 | −5.011e-16 |

- **Decision (pending):** conservative HZ = inner *Runaway Greenhouse (1 M⊕)*, outer *Maximum Greenhouse*.
- TODO at ingest: cross-check against the paper's published ASCII coefficient file (journal version) and store the PDF's SHA-256 in `ingest/data/raw/`.

**Rogers 2015**, "Most 1.6 Earth-radius planets are not rocky", *ApJ* 801, 41, doi:10.1088/0004-637X/801/1/41, arXiv:1407.4457. The abstract confirms the 1.6 R⊕ framing. TODO: quote the exact threshold wording from the body text, not the abstract, before storing the `threshold` doc.

### 5. Archive acknowledgement (README + post)

> "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program."

Cite **Christiansen et al. (2025), Planetary Science Journal** for the PS and PSCompPars tables (it supersedes Akeson et al. 2013). Source: https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html. TODO: get the exact bibliographic entry and the table DOIs from the archive DOI page.

### 6. Toolchain

- **TypeScript 7.0.2** is the Go-native compiler and does not expose a stable JS compiler API. Next.js 16.3 refuses to type-check with it unless `experimental.useTypeScriptCli` is set, and the JS-API consumers (typescript-eslint, Sanity tooling) are a risk. **Decision: pin `typescript@5.9.3`** (latest 5.x).
- Versions resolved today: `sanity` 6.17.0, `next` 16.3.8, `react` 19.3.0, `ai` 7.0.127, `@ai-sdk/google` 4.0.87, `@ai-sdk/mcp` 2.0.66, `vitest` 5.0.3, `@playwright/test` 1.63.0, `@axe-core/playwright` 4.13.0, `zod` 4.6.5.

### Prompts / process notes

- Worked: asking a cheap discovery call (`models.list`) to double as the auth check, which also gave verified model IDs for free.
- Worked: reading `TAP_SCHEMA.columns` instead of the archive's deprecated column HTML page.
- Failed: WebFetch on the Kopparapu arXiv PDF (the summariser refused compressed PDF content). Fixed by extracting the saved PDF text with `pypdf` locally.
- Failed: an attempt to print env-var lengths and prefixes was blocked by the harness as credential exposure. That was the right call; the auth check now loads the key in-process and prints only the HTTP status.

### 7. Workspace scaffold

- pnpm workspace with `studio` (Sanity 6.17.0, port 3334), `web` (Next 16.3.8 App Router, port 3001), `agent` (ai + @ai-sdk/google + @ai-sdk/mcp + zod), `ingest`, `eval`, `docs`. Root `tsconfig.base.json`, Vitest at the root. TypeScript pinned to 5.9.3 everywhere.
- `ingest` and `eval` use Node 24's native TypeScript stripping (`node fetch.ts`), so no tsx/ts-node.
- Stuck: `pnpm -r typecheck` failed with `TS18003 No inputs were found` for empty packages, and pnpm then aborted the sibling runs, which looked like agent/studio failures too. Fixed with `export {}` entry files.
- Stuck: `sanity build` hung waiting on an interactive prompt. Fixed: `sanity build --yes` (exits 0 in ~45 s).
- Verified: `pnpm -r typecheck` passes, `next build` passes (TS 5.9.3), `sanity build --yes` passes. The Studio has no project ID yet (`SANITY_STUDIO_PROJECT_ID` is read from env).

### 8. Source lists for the snapshot (owner downloads; agent does not)

- Owner asked for verified source lists and will download into `ingest/data/raw/` with a MANIFEST. The agent only made status checks and `TOP 200` probes streamed to /dev/null; no files were saved.
- **KB Website sources crawl.** Docs: "A crawl starting from a URL. Crawls respect `robots.txt`. Use the most specific URL you can." No single-page option or page cap is documented. The archive's robots.txt does not disallow `/docs`, and each doc page has 87–130 internal links, so one URL source could blow the 150 cap (best-track saw 675 docs from one NHC page). **Decision: archive doc pages go in as Files sources (downloaded HTML), not Website sources.**
- Dataset sources: "One dataset source matches at most 5,000 documents."
- `pscomppars` has no `rowupdate` column; the first composite probe returned HTTP 400 until it was dropped.
- Table DOIs: PS = 10.26133/NEA12, PSCompPars = 10.26133/NEA13 (https://www.ipac.caltech.edu/dois/exoplanet-archive). doi.org redirects to catcopy.ipac.caltech.edu, which did not connect from this machine.
- No explicit licence found. The archive states the data "have been published and can be used for additional research with the appropriate acknowledgements".

### 9. Owner decisions and the prepared doc snapshot

- **Demo framing decided (owner):** lead with **mass-value swaps**. The default row gives `Msini`, the composite gives a true mass from another paper, e.g. HD 10180 c at 13.2 vs 2741.6 M⊕ (Kiefer et al. 2021): two numbers that cannot both be right, across ~100 planets, so not cherry-picked. Second class: **missing vs filled** (the default refuses, the composite supplies a "Calculated Value").
- **KB conflict framing decided:** the archive documents the *rule* ("not necessarily self-consistent"; the default "may not necessarily be the most precise value"), not per-planet claims. The resolution rests on the archive's own words via the KB Purpose. Conflicts themselves come from the default-vs-composite dataset sources.
- **"Calculated Value" explained by the archive** (`nea-docs/txt/pscp_calc.txt` l.77, l.91): a missing radius is derived from mass, or a missing mass from radius, with the Chen & Kipping (2017) mass–radius relation. Good KB material for the "missing vs filled" class.
- ⚠️ TODO on snapshot: check `pl_bmasselim` on the composite's Kiefer et al. 2021 masses. If they are flagged as **upper limits**, the "13.2 vs 2741.6" contrast compares a measurement with a limit and must be presented that way. The pscp_calc text does not explain why best mass prefers a true mass over a default `Msini`; do not claim a reason until a doc states one.
- **Doc snapshot prepared by owner** in `ingest/data/raw/nea-docs/` (HTML + `txt/` tag-stripped copies, `MANIFEST.tsv`, `MANIFEST-derived.tsv`). Agent re-hashed every file: all 12 SHA-256 and sizes match their manifests.
- `archive-dois.html` (the IPAC DOI listing) is present although intended to be skipped, and it embeds a Rails CSRF `authenticity_token` issued at fetch time. Excluded from the first commit pending an owner decision. **Not a KB source.**
- Long TAP URLs got mangled by terminal wrapping in chat. **Fix: URLs live in `ingest/sources.json`** (generated in code from the column lists; each URL is checked to decode back to its ADQL; `TOP 5` probe → HTTP 200). Rule: never send long URLs through chat.
- Process note: the owner downloads all external sources; the agent only verifies status codes, probes and checksums.

### 10. KB endpoint live (owner-built, owner-verified)

- Endpoint `defaultflag-kb`, Knowledge Base mode, KB id `kbhX0D4yDJok`, 7 entries (e.g. parameter_provenance, composite_parameters, derived_quantities, table_schema). URL pattern as in §2, org-scoped.
- Tools reported by `tools/list`: `initial_context`, **`knowledge_base_search`**, `knowledge_base_read`. `knowledge_base_search` was **not** on the docs' KB-mode tool list read in §2, so the docs lag the service again. Runtime discovery stays mandatory.
- **Sanity's generated connect snippet is wrong for KB-mode endpoints:** it lists dataset-mode tools (`schema_explorer`, `groq_query`, `array_field_reader`) and suggests `SANITY_API_READ_TOKEN`. A project read token is rejected by Context; only the org token (Context Viewer) works. The snippet is the same boilerplate for every endpoint regardless of mode. Ignore it.
- Rules: never hardcode tool schemas or KB entry paths (best-track saw every path renamed on a rebuild); resolve via `knowledge_base_search` / `initial_context`. **The KB explains rules only; never quote a planet parameter from it.** Every number comes from the snapshot via the dataset endpoint (after ingest).

### 11. Schema, schema deploy, ingest (2026-10-03)

**Table snapshot** (`ingest/data/raw/nea-tables/`, owner-fetched): both CSVs match MANIFEST size + SHA-256, row counts match (ps 40,194; pscomppars 6,375), and each MANIFEST `source_url` is byte-identical to `ingest/sources.json`.

**HD 10180 c — checked against the snapshot, flagship framing corrected:**
- The archive's own column definition explains the swap: `pl_bmasse` is the "Best planet mass estimate available, in order of preference: Mass, M*sin(i)/sin(i), or M*sin(i)" (`nea-docs/txt/API_PS_columns.txt`). The composite picks a `Mass` from another paper over the default's `Msini`; that is a documented rule, not an archive bug. The same file describes M*sin(i) as the "lower limit of the measured planet mass".
- The composite's 2741.59 M⊕ (Kiefer et al. 2021) has **`pl_bmasselim = 1` and no uncertainties**. It is a limit, not a measurement. Neither the snapshotted docs nor the TAP schema (`description = "...Limit Flag"`) define the sign convention; a web-search summary claimed +1 = '>', but no archive page we fetched states it. **Unconfirmed; do not interpret.** If +1 means an upper limit, then "≥13.2 (Msini) and ≤2741.6" are *consistent*, not contradictory.
- HD 10180 c has **no radius in any row or in the composite**, so no density can be computed from either side. The "density wrong by ~207×" claim does not hold.
- Population: all 100 swaps go from a default `Msini`; 95 to `Mass`, 5 to `Msin(i)/sin(i)`. 25 of the 100 composite values carry limit flag 1 (all Kiefer et al. 2021 here) and 75 are flag 0 (measured). Only one swap planet has a measured radius on both sides: **Kepler-139 d** (default 4.66 M⊕ Msini, Weiss et al. 2024 → composite 2.00 M⊕ Mass, Lammers & Winn 2025; R = 1.695 R⊕ both; density 5.27 vs 2.26 g/cm³).
- Strongest measured swaps (limit flag 0): ups And c 629.6 → 4443.2 M⊕ (McArthur et al. 2010, 7.1×), gam Cep b 5.8×, HD 142 b 5.7×. Their composite radii are all "Calculated Value" (Chen & Kipping relation applied to the swapped mass), so a composite density for them is built from a mass from one paper and a radius *derived from that mass*.

**Document ids — spec scheme changed.** Sanity docs: "All documents that contain a `.` in their _id can only be accessed when a user is logged in or a valid authentication token is provided." The spec's `pset.k2-18-b.<ref>` would hide every document from anonymous judges. Ids use hyphens: `planet-<slug>`, `pset-<planet>-<ref>`, `pub-<ref>`, `star-<host>`, `stsol-<host>-<ref>`, `snapshot-<file>`. Publication slugs come from the citation text; if two papers share a citation text, every one of them gets its bibcode appended (decided over all refs in both tables, so ids don't depend on the selection).

**Schema** (`studio/schemaTypes/`): the spec types plus `snapshot` (one doc per raw file: sha256, rows, source URL, retrieval time) and two objects: `measurement` (value, errPlus, errMinus as non-negative magnitudes, limitFlag verbatim) and `compositeValue` (measurement + publication ref or `calculated: true` + reference text). `parameterSet` carries `massKind` (pl_bmassprov verbatim), archive insolation/Teq (for formula tests only) and a SHA-256 of its source CSV row. A planet's `defaultParameterSet` has a Studio validation rule enforcing exactly one default; `derivedAnswer.inputs` rejects any input from another set. `constant`, `threshold` and `hzLimit` are defined but **not seeded**: each needs a source URL + location, and the constants' sources are not verified yet.

**Selection** (`ingest/select.ts` → `ingest/data/selection.json`): 22 planets, 97 parameter sets. Rules: owner-pinned HD 10180 c; top 6 measured mass swaps (≤5 sets); swaps with a measured radius on both sides (Kepler-139 d); the spec's 5 named planets; the spec refusal (Proxima Cen b: 5 sets, 0 with a radius); top 8 planets where the choice of self-consistent set changes density (≤3 sets). Over the spec's "under about 90 sets": the 6 spec-named planets + Kepler-139 d alone are 49 sets.

**Ingest results:** 310 documents (97 parameterSet, 86 stellarSolution, 82 publication, 22 planet, 21 star, 2 snapshot). `normalise.ts` is byte-identical across runs (NDJSON sha256 `1a009c94…`). 6 parameter sets use a stellar reference different from their planet reference; both are stored.

**Stuck → fixed:**
- Bash heredoc with nested quotes failed to parse and wrote nothing → wrote schema files with the editor tool.
- `sanity` not on PATH when the wrapper ran outside pnpm → wrapper prepends `studio/node_modules/.bin`.
- `sanity dataset import` with `SANITY_AUTH_TOKEN` → "Insufficient permissions; permission "create" required". That token deploys schemas but cannot write documents. Fixed by `ingest/import.ts`, which uses `SANITY_API_WRITE_TOKEN` (the ingest token per `.env.local.example`), diffs against the dataset, and writes create/update/delete in **one transaction** (planet ↔ parameterSet references are circular). The CLI also warns the positional dataset argument is deprecated (`--dataset`).
- **Idempotency proven:** run 1 created 310 (transaction `mpuIrjeRtdUv3cODojFk2q`); a full rerun (select → normalise → import) reported `create 0, update 0, delete 0`.
- **Public read verified:** an anonymous GROQ query on `production` returns HTTP 200. Integrity checks in GROQ: planets without exactly one default = `[]`; defaultParameterSet not a default set = `[]`.

### 12. Physics, agent, site, evaluation, CI (2026-10-04)

**Decisions made without an explicit owner answer (owner said "complete it fully"):**
- Chips: **"Density of Kepler-139 d?"** replaces the spec's K2-18 b chip. K2-18 b's composite equals its default (3.70 g/cm³ both ways), so its composite toggle would show nothing. Kepler-139 d is the one planet where both sides give a measured-radius density (5.29 vs 2.40 g/cm³). The other two chips are the spec's.
- HD 10180 c stays in the dataset as the "a limit passed off as best mass" case; both sides refuse density, and the composite refuses because its mass carries a non-zero limit flag.
- Values the archive flags with a non-zero limit flag are refused ("a limit, not a measurement"), never computed.
- A density from an `Msini` mass is computed but flagged as a lower limit (the archive's own wording for M*sin(i)).

**Reference values** (`ingest/data/reference.json`, imported as `constant` / `threshold` / `hzLimit`):
- IAU 2015 B3 (arXiv:1510.07674, PDF text read locally): nominal R_sun = 6.957e8 m, T_eff,sun = 5772 K; endnote 4 quotes IAU 2012 B2: 1 au = 149 597 870 700 m exactly. R_sun/au = 0.0046504673 ✓ the spec's 0.00465047.
- Kopparapu 2014 conservative limits: inner Runaway Greenhouse (1 M⊕), outer Maximum Greenhouse, Table 1 p. 12, valid 2600–7200 K.
- Rogers 2015 rocky threshold 1.6 R⊕ (abstract wording).
- **Not verified:** Earth density 5.514 g/cm³. nssdc.gsfc.nasa.gov resets the TLS connection from this machine (WebFetch ECONNRESET, curl exit 35). Stored with a note; owner to confirm.
- Albedo 0.3 stored as an explicit modelling assumption, not a fact.

**Physics** (`agent/tools/physics.ts`): density, luminosity, insolation, T_eq (stellar radius converted to AU), Kopparapu S_eff, HZ class, split-normal Monte Carlo (mulberry32, seed 20261003, 10,000 draws, rejection of non-positive draws). Tests: Earth–Sun gives 5.514 / 1 / ~255 K; S_eff equals S_eff,sun at 5780 K; determinism; **agreement with the archive's own pl_insol and pl_eqt columns: median relative difference < 5% over 500+ default rows each** (T_eq compared at A = 0, the archive's usual convention).

**Live compute on the dataset** (no model): Kepler-139 d 5.29 [3.05–7.69] vs composite 2.40; Proxima Cen b refuses (no radius) vs composite **5.49 from a "Calculated Value" radius**; TOI-700 d insolation refuses (no Teff) vs composite 0.81 mixing Pass 2026 + Gilbert 2023; HD 10180 c refuses both ways; TRAPPIST-1 e inside the HZ, p = 0.96, flagged as extrapolated (2566 K).

**Derived answers:** 63 `derivedAnswer` documents (every quantity each default set supports), inputs referencing their single set. Dataset now 380 documents. Import of the second run: 0 changes.

**AI SDK v7 API, read from the installed .d.ts, not memory:**
- `stepCountIs` is now an alias of `isStepCount`.
- Tool results are `{toolName, input, output}`.
- The MCP client has `listTools()` + `toolsFromDefinitions()`; we use these so schemas come only from the server.
- Gemini thinking: `providerOptions.google.thinkingConfig.thinkingLevel`.
- **Stuck:** a 20-token probe returned empty text; usage showed 74 reasoning tokens of 75. Fixed by setting `thinkingLevel: 'low'` explicitly (recorded in eval settings) and a 2,000-token cap.

**Context endpoints:**
- `defaultflag-kb` lists `initial_context, knowledge_base_read, knowledge_base_search`.
- **`defaultflag-data` returns 404 "MCP endpoint not found"; owner must create it.**
- Both endpoints expose `initial_context`, so discovered tools are prefixed `data_` / `kb_`.

**Output guard** (`agent/guard.ts`):
- Every number must round-match a number in a data/compute tool result of the turn.
- **Knowledge Base results are excluded as a number source** (owner rule: the KB explains rules, never planet values).
- Cited ids and `kb:` paths must have been read; quotes must match exactly.
- Retry once with the violations, then withhold.
- 9 tests.

**Site:**
- Pages: `/` (chips, cached-then-live answers, failure banner naming the component, provenance strip with mass kind and snapshot checksum, composite toggle, trace), `/planet/[slug]` (every set side by side, default highlighted, all four quantities per set, composite with its references), `/eval`, `/how-it-works`.
- Rate limit: 6 questions/min per IP, 300-character cap.
- **Stuck:** the screenshots showed a completely unstyled site. Cause: a `next start` left running from before a rebuild served HTML pointing at deleted CSS chunks, and the axe contrast test had "passed" against that unstyled page. Fixed by stopping the stale server. Lesson: always restart before e2e.
- axe then found two real contrast failures (tags on the tinted default row, 4.25 and 4.31); fixed by darkening tokens.

**Evaluation** (`eval/`):
- 40 frozen questions; truth from the raw CSV via the same physics code.
- **The scoring rule doesn't parse prose:** every arm is told to end with a `FINAL:` line (same suffix for all arms).
- Mixing check: every input value an arm passed to compute is matched back to the snapshot rows; no single row containing all of them = mixed.
- Baselines search the same documents (the imported NDJSON rendered as text + the archive doc pages); semantic arm uses `gemini-embedding-2`.
- Smoke run (4 questions × 3 baseline arms) works. It caught a scoring gap: a number given to a refusal question (BM25 answered Proxima's density) was not checked for mixing. Fixed: any derived numeric answer is checked.
- **Full run pending `defaultflag-data`.**

**Failed / fixed:**
- Node's TypeScript stripping rejects constructor parameter properties (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). Rewrote two classes and enabled `erasableSyntaxOnly` so `tsc` catches it.
- `check-dataset` falsely reported 22 violations from a mis-scoped `^.^._id`. Rewritten with dereferences; the GROQ checks are now all 0.

**CI** (`.github/workflows/ci.yml`):
- Steps: snapshot checksums, deterministic normalise (two runs, then `git diff`), typecheck, lint (54 files, 0 problems), unit tests + offline eval subset (34 tests), GROQ dataset validation, KB budget (49/150), build, then Playwright judge path + axe on desktop and mobile.
- No secrets. `SANITY_PROJECT_ID` is a repo variable.
- **The chip and /eval e2e tests will fail until the cached chip answers and the first full eval result are committed; both need `defaultflag-data`.**

### 13. Coordination findings applied (2026-10-03T23:50Z onwards)

- **Model pin changed: `gemini-3.8-flash` → `gemini-3.7-flash`** (guidance F21). Checked directly: `models.get` reports `version: "3.0"` for gemini-3.8-flash but `3.7-flash-08-2026` for gemini-3.7-flash. Both generate. A pin whose reported version is a bare "3.0" can't be recorded meaningfully in eval results. `thinkingLevel: 'low'` works on 3.7 (no warnings). The eval runner now reads the version from `models.get` at run start and stores it as `modelVersion` in every results file. The earlier 4-question smoke run used 3.8 and was discarded (never committed).
- **Growth trial expiry (F5): not readable via the API.** `GET /projects/<id>` has no plan or trial field and `/projects/<id>/plan` is 404. Owner to read it from Manage → Plan and record it here.
- **`knowledge_base_search` is BM25 keyword search (F15).** So the structured arm's advantage over the BM25 baseline can't come from KB retrieval. It comes from the GROQ dataset endpoint plus `compute(setId)` reading exactly one parameter set. The KB contributes explanations only, and the guard ignores its numbers.

### 14. Guidance 2026-10-04T00:18Z applied

- **`nea-docs/archive-dois.*` committed** (guidance reversed its skip advice: the page carries the table DOIs NEA12/NEA13). The staged blob matches its MANIFEST SHA-256. It embeds a session CSRF token the IPAC site issued at fetch time; that is not a project credential. Added to `kb/sources.json` (file sources: 6) and to the eval corpus, so all arms search the same documents.
- **CI then got past the checksum step and failed at `pnpm build`.** Turbopack resolves `new URL('../.env.local', import.meta.url)` as an asset at build time; CI has no `.env.local`, so `Module not found`. Local builds passed because the file exists, a failure class the local machine cannot show. Fixed by moving `loadEnv` to `agent/env.ts`, imported only by scripts, never by the web bundle. Verified by building with `.env.local` moved aside.
- **TypeScript pinned to 6.0.3** (F35, supersedes the 5.9.3 pin). Typecheck, 34 tests, lint and the Next build are all clean.
- **ups And c added** as `owner-pinned-compounding`. Default set Curiel et al. 2011 has no radius, so density refuses. The composite gives 13.19 g/cm³ [8.35–15.36] from McArthur et al. 2010's true mass (4443.2 M⊕) and a 12.3 R⊕ radius the archive *calculated from that mass*: the density is built on itself.
- **Selection widened** (TOP_SWAP 6→10, TOP_SPREAD 8→12, per-planet set caps unchanged so every eval planet stays): **31 planets, 129 parameter sets**; no planet dropped; 504 documents (88 derived answers). The spec's "about 30 planets" and "under about 90 sets" cannot both hold, since its six named planets carry 39 sets. Planet target kept; stated in README and post.
- KB sources now 31 + 31 + 6 = **68 / 150**. Import rerun: 0 changes. GROQ checks: 0 violations.
- Probe script fixed: it now uses the agent's thinking setting (it printed empty replies before).

### 15. Deployed; submission prep without GitHub (2026-10-04)

- **GitHub became unreachable:** `git ls-remote origin` → "Repository not found" for the logged-in account. Owner asked to prepare everything except GitHub; commits stay local until access returns.
- **Context endpoints can only be created in the Context app UI.** The configure-MCP docs mention no CLI or API, and our org token is Context Viewer. `defaultflag-data` is still 404, so `scripts/finish.mjs` does everything after it in one command: probe → cache chips → full eval → tests → dataset checks → deploy. Verified it stops cleanly at the probe today.
- **Vercel:** linked a new project `default-flag` (team `lk-c2be`) from the repo root.
  - Settings set via REST: root directory `web`, framework Next.js, Node 24.x, `sourceFilesOutsideRootDirectory` on (the app imports `agent/`).
  - Env vars set via REST from a script that never prints values. The two credentials are stored as Vercel "sensitive" vars. Only the five runtime vars plus `ENABLE_EXPERIMENTAL_COREPACK=1` (so the build uses `packageManager: pnpm@12.8.1`) are uploaded; the Sanity write token stays local.
  - `.vercelignore` excludes `.env*`, raw snapshots and build output.
  - Deployed to https://default-flag.vercel.app. All pages return 200 anonymously. `/api/ask` returns the visible "Sanity Context … endpoint unavailable" error, as designed.
  - The local CLI printed "Error while parsing config file pnpm-lock.yaml" (pnpm 12 lockfile vs the CLI's parser); the remote build was unaffected.
- **Stuck:** in this session `pnpm` failed from bash: Anaconda's `cygpath` is now first on PATH, so the shell wrapper resolves `pnpm.exe` to a bogus `C:\ProgramData\anaconda3\Library\c\...` path. PowerShell's `pnpm.cmd` works. Not fixed (machine PATH, not repo); Windows-side pnpm commands go through PowerShell.
- **`scripts/scan-secrets.mjs`** for the public agent session: matches the literal values of every credential in `.env.local` plus token shapes, prints only file:line and which secret. All 89 tracked files clean.
- Owner runbook `docs/OWNER_STEPS.md`; captioned video script `docs/VIDEO_SCRIPT.md`. The post draft now has the demo URL and project ID.

### 16. Dataset endpoint live (2026-10-05)

- **Correction to §2 and guidance F2: Context dataset mode DOES need a deployed Studio.** After the owner created the endpoint, the Context app showed "Not ready. Some things need fixing", with "Studio: No Studio application found for this project/dataset" and "Schema: Studio check failed — no schema descriptor available", even though `sanity schema deploy` had run. Deploying the Studio (`studioHost: 'default-flag'` → https://default-flag.sanity.studio, appId recorded under `deployment` in `studio/sanity.cli.ts`) turned it to "Ready to connect", "Schema: 10 content types". The spec's original claim was right; the docs' "deployed schema" wording is not sufficient on its own.
- **Endpoint name was auto-filled from the title.** The owner titled it "Default Flag data" and the Name became `default-flag-data`, not `defaultflag-data`, and it can't be changed. Found by probing likely names with `tools/list`. The code default, the site, the README, the runbook and the post now use `default-flag-data`.
- Dataset-mode tools from `tools/list`: `initial_context, groq_query, schema_explorer, array_field_reader`.
- **First live run:** "Density of Kepler-139 d?" took 9 tool calls across both endpoints. It answered 5.29 g/cm³ from Weiss et al. 2024 only, flagged the minimum mass, and the composite counterfactual gave 2.40 from Lammers & Winn 2025 + Weiss et al. 2024. About 71k input tokens per question.
- **Guard false positive, fixed:** both first drafts were rejected for "number 16" and "number 84", the *ordinals* in "16th–84th percentile" that my own prompt asked for. The guard now ignores ordinals, and accepts a percentage when the tool returned the matching fraction (e.g. 96% for 0.9625). A regression test caught my first fix silently letting sentence-final numbers ("42.0.") through; fixed. 38 tests.
- The guard result now keeps `firstViolations` when it retries, so the trace shows what was rejected.
- Prompt now asks for three significant figures and plain text: one draft printed 15-digit medians, another LaTeX.

### 17. Evaluation run 2 and the Knowledge Base conflict (2026-10-05)

- **Eval run 2** (`eval/results/2026-10-04.md`, model gemini-3.7-flash, version 3.7-flash-08-2026):

  | Arm | Accuracy | Mixed-provenance | Refusals |
  | --- | --- | --- | --- |
  | Structured | 98% | 0% (0/29) | 5/5 |
  | Semantic | 93% | 3% | 3/5 |
  | BM25 | 98% | 3% | 4/5 |
  | No content | 45% | 35% | 3/5 |

  Run 1 is kept as `2026-10-04-run1.*`. Its only structured miss (t10) was a guard false positive on 3-s.f. rounding ("1240" for 1244), fixed before run 2. Run 2's only structured miss (h01) was withheld by the guard; two manual reruns passed, so it is intermittent. The results file did not record guard reasons. TODO: store them.
- **The spec's expected headline did not hold.** Baselines over the same structured documents rarely mix (3%), because each parameter set is a self-contained document. Their real failure: on r02 and r05 they silently answered from a non-default paper's set (Rodriguez et al. 2020, Wittenmyer et al. 2012) instead of refusing. The mixed-provenance metric doesn't count that. Reported in the post as an observation, not as a new metric added after seeing the results.
- **Knowledge Base dataset source:**
  - **Context allows one source per dataset** ("production already a source"), so the two planned GROQ sources became one query, `kb/query-combined.groq`. It gives every planet two documents (default set and composite row) with identical field names; 62 documents.
  - The preview rows were blank until the projection had `title`/`name` fields.
  - The first attach produced "Rebuild required … no per-planet branch"; a rebuild made 8 entries, including `planet_catalogue/*`.
- **No conflict was raised in Issues.** The build applied the Purpose rule directly: separate "Default parameter sets (preferred…)" and "Composite table (mixed-source alternatives)" tables, plus an explicit line that Kepler-139 d's composite mass differs from its default. Spec fallback used; evidence in `docs/KB_CONFLICT.md`.
- **Answer that changes:** asked which mass to use for Kepler-139 d, the agent now answers 4.66 M⊕ from Weiss et al. 2024 and explains the composite's 2 M⊕ comes from Lammers & Winn 2025, citing `kb:parameter_sets/default`. The density itself stays 5.29 by design.
- **Entry paths changed on rebuild** (`parameter_provenance` disappeared), confirming F11 independently.
- Guard false positive seen once more: "-1" (probably from a hyphenated designation) on a first draft; the retry passed. Not yet fixed.
