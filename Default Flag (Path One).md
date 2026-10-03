# Default Flag: standalone build spec (Path One)

Oct 3, 2026 · @hassan

## Overview and standards

Build Default Flag: a Path One agent that answers derived exoplanet questions from one self-consistent parameter set per planet, and shows the different answer that mixing values from several papers would give. The target is a full score on the unofficial scorecard: all four judging criteria at 5 and every checklist item present.

### The challenge rules this build must satisfy

- **Event.** The Sanity Challenge on DEV, Path One: "Ship an Agent That Queries Real Content." Build an agent and point it at a Sanity Context MCP endpoint backed by a Knowledge Base.
- **Judging criteria.**
  - Meaningful use of Sanity Context and structured content.
  - Technical implementation and code quality.
  - Use of Knowledge Bases.
  - Usability.
- **The brief's bar.** The agent should only work because the content is structured; if a keyword search would give the same answer, it is not enough. Knowledge Bases are in beta and index up to 150 documents; an endpoint over the full dataset with embeddings also counts.
- **Requirements.**
  - A DEV post using the Path One template with the `#sanitychallenge` tag.
  - The Sanity project ID or a public dataset URL.
  - Testing credentials if anything needs a login.
  - Only one submission per path.
- **Encouraged.** A public agent session uploaded through DEV's Agent Sessions uploader.

### What earns a 5 on each criterion

| Criterion | What the build must show |
| --- | --- |
| Sanity Context and structured content | Every derived answer uses inputs from one parameter set; a "mixed-provenance rate" of 0% is shown, against higher rates for the baselines |
| Technical implementation | Snapshot data in the repo, unit-tested formulas, Monte Carlo uncertainty, an output guard, a four-arm evaluation in CI |
| Use of Knowledge Bases | A Knowledge Base under 150 documents, a real default-vs-composite conflict resolved, and an answer that visibly changes because of it |
| Usability | No-login demo, three example chips, provenance strip, composite toggle, polite refusals, video |

### Scope

- **In:** about 30 planets, all their published parameter sets, derived density, insolation, equilibrium temperature, habitable-zone status, and which paper each number came from.
- **Out:** population statistics, atmospheres, live archive queries at answer time (the app reads the snapshot stored in Sanity).

### Ground rules

- **Check the docs first.** Read the current Sanity docs before coding against Sanity Context or Knowledge Bases; both change quickly and Knowledge Bases are in beta. Anything marked **Verify** in this spec comes from other entrants' posts or memory and must be confirmed first.
- **Never invent facts.** Never make up data, IDs, citations or API fields. Every stored fact carries a source URL and a retrieval date.
- **Code computes, the model explains.** Deterministic code produces every number; the model only routes, picks evidence and writes prose. Any number shown to a user must appear in a tool result from that turn.
- **Snapshot the data.** Save all external data to `ingest/data/raw/`, each file stored next to its retrieval date and SHA-256 checksum, so evaluations reproduce.
- **Keep a build log from day one.** Write to `docs/BUILD_LOG.md`: prompts that worked, prompts that failed, where you got stuck, how you fixed it, and what you cut. The post is written from this file.
- **Keep secrets server-side.** Never commit or expose tokens. Before making the agent session public, scan the transcript for secrets.

### Stack

| Layer | Choice | Note |
| --- | --- | --- |
| Runtime | Node 22.12+, TypeScript, pnpm workspaces | **Verify:** one entrant reported Studio v6 needs Node 22.12 or later |
| Content | Sanity Studio, deployed with `sanity deploy` | Entrants reported Context's dataset (GROQ) mode fails until a Studio is deployed |
| Public site | Next.js (App Router) on Vercel | No login on any public page |
| Agent | Anthropic SDK or Vercel AI SDK with an MCP client | Discover tools with MCP `tools/list` at runtime; never hardcode tool schemas |
| Tests | Vitest (unit), Playwright (end-to-end), axe-core (accessibility) | All run in CI |
| CI | GitHub Actions | Typecheck, lint, test, build, offline evaluation subset; badge in README |

### Repo layout

```
/studio    Sanity Studio: schemas, desk structure, validation
/web       Next.js public site + API routes (agent, read-only proxies)
/agent     agent loop, tool wrappers, physics.ts, system prompt, output guard
/ingest    fetch -> select -> normalise -> NDJSON; data/raw snapshots with checksums
/eval      questions.json, truth.ts, runner, baselines, results
/docs      BUILD_LOG.md, decision records, screenshots, video script
```

### Sanity setup

- **Project and dataset.** One project with a `production` dataset that is publicly readable, so judges can run GROQ without a token.
- **Stable IDs.** Deterministic document IDs from the source key (for example `pset.k2-18-b.<refslug>`), so re-imports update instead of duplicating.
- **Imports.** Use NDJSON with `sanity dataset import`; one entrant hit a failure importing a JSON array instead.
- **CORS.** Add the production site and localhost as CORS origins.
- **Public query URL for the post.** **Verify** the current API version date:

```
https://<projectId>.api.sanity.io/v2025-02-19/data/query/production?query=*[_type=="planet"][0...5]
```

### Sanity Context setup

- **Two endpoints.** One in dataset (GROQ) mode for structured facts, one in Knowledge Base mode for prose explanations. **Verify:** entrants reported an endpoint serves one mode, and if both sources are attached the dataset wins and the Knowledge Base is silently ignored.
- **Endpoint URL.** Entrants used `https://api.sanity.io/v1/context/organizations/<orgId>/mcp/<endpointName>`. **Verify** against the docs.
- **Tool names.** Entrants saw `initial_context`, `knowledge_base_read` and `groq_query`. Read the real names from `tools/list` at startup and log them.
- **Knowledge Base budget.** At most 150 documents, checked by a script in CI.
- **Conflicts.** After each Knowledge Base build, review every issue Context raises. Resolve at least one real conflict with a standing instruction, screenshot it before and after, and show an answer that changes because of it.

### Agent rules

- **System prompt.** Answer only from tool results in this turn, cite document IDs or Knowledge Base entry paths, never fill gaps from model memory, and say "not in the data" when coverage is missing.
- **Output guard (code, not prompt).** Before rendering, check that every number in the answer appears in a tool result from this turn, every cited ID was read this turn, and every quote matches its source exactly. On failure, retry once with the list of violations, then fail closed with a visible notice.
- **Trace panel.** Show the tool calls, GROQ queries, Knowledge Base entries opened and deterministic tool outputs for every answer.
- **Model choice.** Any model, but record its name and version in every evaluation result.

## Data, content model and core logic

The data is the NASA Exoplanet Archive's per-paper parameter sets, stored so that every derived number can be traced to exactly one set and one publication.

### Data sources

| Source | What to pull | Terms | Verify |
| --- | --- | --- | --- |
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu) Planetary Systems table (`ps`) | One row per planet per reference; `default_flag` = 1 marks the archive's chosen set | Public archive; cite it in README and post | Column names, including the stellar reference column and mass-provenance column |
| Planetary Systems Composite Parameters table (`pscomppars`) | One row per planet, values combined from several references | Same | Names of the per-parameter reference columns |
| Archive column docs and default-set FAQ pages | Text sources for the Knowledge Base | Same | Current page URLs |
| Kopparapu et al. 2014 habitable-zone coefficients | Inner and outer limit coefficients, stored as data | Cite the paper | Every coefficient against the paper |
| Rocky-planet radius threshold (Rogers 2015, about 1.6 Earth radii) | One threshold document | Cite the paper | Value and citation |

Example TAP query (**Verify** column names in the PS column docs first):

```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,hostname,default_flag,pl_refname,st_refname,pl_rade,pl_radeerr1,pl_radeerr2,pl_bmasse,pl_bmasseerr1,pl_bmasseerr2,pl_orbsmax,pl_orbsmaxerr1,pl_orbsmaxerr2,st_rad,st_raderr1,st_raderr2,st_teff,st_tefferr1,st_tefferr2+from+ps+where+hostname+in+('K2-18','TRAPPIST-1')&format=csv
```

**Planet selection** (`ingest/select.ts` writes `selection.json` with a reason per planet):

1. The 15 to 20 planets where the composite radius or mass differs from the default row by more than one sigma. These carry the demo.
2. Well-known planets: K2-18 b, TRAPPIST-1 e, LHS 1140 b, TOI-700 d, Kepler-452 b.
3. Refusal cases: planets missing a field a question needs. **Verify** that Proxima Cen b has no measured radius in `ps`.

Keep the total under about 90 parameter sets.

### Content model

| Type | Key fields |
| --- | --- |
| `planet` | name, slug, host (ref `star`), parameterSets\[\] (refs), compositeSnapshot (object: each composite value plus its reference) |
| `star` | name, slug |
| `parameterSet` | planet (ref), publication (ref), defaultFlag, radiusEarth / massEarth / semiMajorAxisAu (each {value, errPlus, errMinus}), massKind (mass or minimum mass), stellarSolution (ref) |
| `stellarSolution` | star (ref), publication (ref), radiusSun, massSun, teffK (each with errors) |
| `publication` | refname as given by the archive, bibcode, year, ADS URL |
| `constant` | key, value, unit, source (Earth density 5.514 g/cm3, solar Teff 5772 K, solar radius 0.00465047 AU, default albedo 0.3) |
| `threshold` | key, value, unit, source (rocky radius limit) |
| `hzLimit` | name (inner, outer), coefficients, source |
| `derivedAnswer` | question, parameterSet (ref), quantity, inputs\[\] {field, value, set ref}, result {median, p16, p84}, codeVersion |

**Validation** (Studio rules plus CI checks written in GROQ):

- Exactly one `parameterSet` per planet has defaultFlag = true.
- Every input in a `derivedAnswer` references the same `parameterSet`. CI reports zero violations.
- A `parameterSet` uses the stellar solution published with that row. If the archive row's stellar reference differs from the planet reference, store both and show both in the provenance strip; never swap in another row's star.
- Field names carry units; uncertainties are non-negative.

### Ingest pipeline

1. `ingest/fetch.ts`: run the TAP queries and save CSV snapshots with date and SHA-256.
2. `ingest/select.ts`: apply the selection rules.
3. `ingest/normalise.ts`: build documents with deterministic IDs (`pset.<planet>.<refslug>`), parse the archive's reference strings into text, bibcode and URL, and write NDJSON.
4. Import to `production`. Running steps 1 to 4 twice must produce zero changes.

### Formulas (`agent/tools/physics.ts`)

```latex
\begin{aligned}
\rho_p &= \rho_\oplus \,\frac{M_p/M_\oplus}{(R_p/R_\oplus)^3},\qquad \rho_\oplus = 5.514\ \mathrm{g\,cm^{-3}}\\
\frac{L_\star}{L_\odot} &= \left(\frac{R_\star}{R_\odot}\right)^2\left(\frac{T_{\mathrm{eff}}}{5772\ \mathrm{K}}\right)^4\\
\frac{S}{S_\oplus} &= \frac{L_\star/L_\odot}{(a/\mathrm{AU})^2}\\
T_{\mathrm{eq}} &= T_{\mathrm{eff}}\sqrt{\frac{R_\star}{2a}}\,(1-A)^{1/4}\\
S_{\mathrm{eff}} &= S_{\mathrm{eff},\odot} + aT + bT^2 + cT^3 + dT^4,\qquad T = T_{\mathrm{eff}} - 5780\ \mathrm{K}
\end{aligned}
```

- **Units.** Equilibrium temperature uses the stellar radius and orbital distance in the same unit (1 solar radius = 0.00465047 AU) and albedo A = 0.3 from the `constant` document.
- **Habitable zone.** A planet is inside if S falls between the outer and inner limits from the `hzLimit` documents.
- **Uncertainty.** Propagate with 10,000 Monte Carlo draws from split-normal distributions (asymmetric errors), fixed seed; report the median with the 16th and 84th percentiles.
- **Sanity check for tests.** Earth around the Sun gives density 5.514 g/cm3, S = 1.0 and an equilibrium temperature of about 255 K at A = 0.3.

### Sanity Context and Knowledge Base for this build

- **Endpoints.** `defaultflag-data` (dataset/GROQ mode) covers every type above. `defaultflag-kb` (Knowledge Base mode) serves explanations.
- **Knowledge Base sources, 150 documents or fewer, checked by script:**
  1. A GROQ query flattening each planet with its default set and publication.
  2. A GROQ query over the composite snapshots, as a separate source.
  3. The archive's table-overview and default-set FAQ pages.
- **Expected conflict.** Context should raise issues where a planet's composite radius differs from its default radius. Resolve with the instruction: "For derived quantities, the default parameter set governs; composite values are for population plots only."
- **Demo planet.** Pick the planet whose density class flips across the rocky threshold between the two sources (the selection script finds it). Screenshot the issue before and after, and show the answer changing.
- **If Context raises no issue,** show the conflict side by side from the data anyway and say plainly in the post that the build did not flag it.

### Agent

| Tool | Type | Returns |
| --- | --- | --- |
| `initial_context`, `groq_query`, `knowledge_base_read` | Sanity Context MCP (names read from `tools/list`) | Schema, records, Knowledge Base entries |
| `compute(setId, quantity)` | Local, deterministic | Value, interval, the inputs used, their set and publication |
| `composite_counterfactual(planet, quantity)` | Local, deterministic | The value from composite inputs, plus how many distinct references it mixes |

Answer flow:

1. Identify the planet.
2. Fetch its parameter sets.
3. Use the default set, or a set the user names.
4. Compute the quantity.
5. Read the Knowledge Base for the explanation.
6. Answer with a provenance strip.

If a needed field is null, refuse and name the field (for example: "Proxima Cen b has no measured radius in the archive, so its density can't be computed"). The output guard applies to every answer.

## Site, evaluation and delivery

The build is done when a judge can follow the judge path below without logging in, and every checklist item at the end is ticked.

### Public site

- **`/`**
  - Ask box with three chips: "Density of K2-18 b?", "Is TRAPPIST-1 e in the habitable zone?" and "Density of Proxima Cen b?" (a refusal).
  - Answer card, provenance strip and trace panel.
  - A "What the composite table would give" toggle.
- **`/planet/[slug]`:** every parameter set side by side with the default highlighted, derived values per set, and the composite counterfactual with its mix of papers.
- **`/eval`:** the results table, with a drill-down per question.
- **`/how-it-works`:** endpoints, the Knowledge Base conflict before and after, the schema, snapshot dates and checksums.

**Demo standards for every page:**

- **Instant start.** No login anywhere; the three chips are on the first screen.
- **Visible failures.** Loading states, and a banner naming what failed when Sanity, Context or the model is unavailable; never a silent fallback.
- **Cached examples.** Pre-computed answers for the chips, labelled "cached", so judges see output even if a provider is down.
- **Accessibility.** Mobile layout, full keyboard use, and axe-core with zero serious violations in CI.
- **Rate limits.** Rate-limit the agent API and cap tokens per request.

### Evaluation

- **40 questions** in a frozen `eval/questions.json`:
  - 15 density
  - 10 insolation or equilibrium temperature
  - 5 habitable-zone yes/no
  - 5 provenance ("which paper is this radius from?")
  - 5 refusals
- **Ground truth.** `eval/truth.ts` computes from the default `ps` row in the raw CSV, independent of Sanity and of the model. A numeric answer is correct within 1% of the true median.
- **Four arms, same conditions:**
  1. The structured agent.
  2. A semantic-search baseline over the same documents.
  3. A keyword (BM25) baseline over the same documents.
  4. The model with no content.
- **Fairness.** All arms use the same model, prompt budget and source documents; only retrieval differs. The baselines get the same `compute` tool, which accepts raw numbers, so differences come from retrieval, not arithmetic.
- **Metrics.** Accuracy, mixed-provenance rate, correct refusals and valid citations. To detect mixing in a baseline, match each input value it used back to the snapshot rows.
- **Outputs.** Write `eval/results/<date>.json` (with model name and version) and generate the markdown table for the post. List every failure with a one-line cause.

| Arm | Accuracy | Mixed-provenance rate | Correct refusals | Valid citations |
| --- | --- | --- | --- | --- |
| Structured agent |  |  |  |  |
| Semantic search |  |  |  |  |
| Keyword (BM25) |  |  |  |  |
| No content |  |  |  |  |

### Tests and CI

- **Physics.** The Earth-Sun values above, plus agreement with the archive's own insolation and equilibrium-temperature columns where present.
- **Determinism.** Monte Carlo output is identical across runs with the fixed seed.
- **Validation.** One default per planet; single-set derived answers; Knowledge Base source count at or under 150.
- **Guard.** An answer containing a number no tool returned is rejected.
- **Ingest.** Two runs produce zero changes.
- **End-to-end.** Playwright runs the judge path below, plus axe-core.
- **CI on every push.** Typecheck, lint, unit tests, build and an offline evaluation subset; a CI badge in the README. Run the full evaluation manually and commit the results file.

### DEV post

- **Template.** Path One headings: What I Built, Demo, Code, How I Used Sanity, Sanity Project Details, Agent Session. Tag `#sanitychallenge`.
- **First screen.** One-line pitch, demo link, the four-arm results table and the project ID.
- **How I Used Sanity.**
  - Both endpoints, the Knowledge Base ID and its sources.
  - The conflict screenshots, before and after.
  - The schema as a type list or diagram.
  - The public GROQ query URL.
- **Honesty sections.** What didn't work (from the build log), known limitations, and data sources with licences.
- **Why it's new.** One paragraph on why this differs from existing entries: astronomy, and preventing mixed provenance rather than only surfacing contradictions.
- **Agent session.** A curated session uploaded through the Agent Sessions uploader, set to Make Public.
- **Video.** 2 to 3 minutes with captions, following the judge path: one planet, two radii from two papers; ask the question; flip the toggle; show the conflict resolution; show the results table; finish on the schema and repo.

### Judge path (post, video and Playwright)

1. Click "Density of K2-18 b?" and read the answer with its provenance strip.
2. Turn on the composite toggle and see the other value, built from several papers.
3. Click "Density of Proxima Cen b?" and get a refusal naming the missing field.
4. Open `/eval` for the four-arm table.
5. Open `/how-it-works` for the Knowledge Base conflict, before and after.

### Acceptance checklist

- [ ] The post states Path One and uses the template
- [ ] Project ID and public dataset query URL appear in the post
- [ ] Live demo works with no login
- [ ] Public repo is linked, with a README and CI badge
- [ ] A 2-3 minute video walkthrough is linked
- [ ] A public agent session is embedded
- [ ] Testing instructions are in the post
- [ ] The agent reads through a Sanity Context MCP endpoint
- [ ] A real Knowledge Base is used and its ID is shown
- [ ] Conflicting sources are shown side by side
- [ ] The four-arm evaluation appears near the top of the post
- [ ] Known-limitations and what-didn't-work sections
- [ ] Real, cited public data
- [ ] The schema is shown in the post
- [ ] Build process notes: prompts that worked and failed, where the model got stuck
- [ ] A paragraph on why the idea is new

### Risks and Verify list

- **Verify** all column names in `ps` and `pscomppars` before writing the ingest.
- **Verify** at build time which planets actually differ between default and composite; do not assume any named planet does.
- **Verify** the Kopparapu coefficients and the rocky threshold against their papers.
- **Verify** the archive's acknowledgement wording and use it in the README.
- **Verify** the Context endpoint URL, modes and tool names in the current docs.
- **Risk:** if TAP is slow, fetch once and work from the snapshot.
