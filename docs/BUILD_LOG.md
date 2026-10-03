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
