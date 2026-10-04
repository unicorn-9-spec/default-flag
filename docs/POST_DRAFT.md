---
title: "Default Flag: an exoplanet agent that won't mix papers"
published: false
tags: sanitychallenge, ai, astronomy, agents
cover_image: [IMAGE: cover image — suggest docs/screenshots/05-refusal-and-composite.png or 03-composite-toggle.png]
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

**Default Flag** answers derived exoplanet questions (density, insolation, equilibrium temperature, habitable-zone status) from **one self-consistent published parameter set per planet**, and shows, as a labelled counterfactual, the different answer you get by mixing values from several papers.

**Live demo, no login:** https://default-flag.vercel.app · **Code:** https://github.com/unicorn-9-spec/default-flag · **Sanity project:** `0eu544dk`, dataset `production` (public)

[SCREENSHOT: docs/screenshots/06-planet-parameter-sets.png — Kepler-139 d: ten published parameter sets, the archive default highlighted, derived values computed per set]

The NASA Exoplanet Archive keeps every published solution for a planet as its own row and flags one as the default. It also publishes a composite table with one row per planet, filled parameter by parameter from whichever paper its rules pick. The archive itself calls that table "a more complete, though not necessarily self-consistent, set of parameters". Answers built on the composite row can combine a mass from one paper with a radius from another, or with a radius the archive calculated from that mass.

Default Flag never does that. Every number comes from deterministic code reading exactly one parameter set (plus the stellar values published with it). The composite answer appears only behind a "What the composite table would give" toggle.

- **Kepler-139 d.** Weiss et al. 2024 gives a density of **5.29 g/cm³**. Their mass is M·sin i, which the archive calls a lower limit, so the answer says the density is a lower limit. The composite row takes its mass from Lammers & Winn 2025 instead and gives **2.40 g/cm³**: less than half, from two papers that never published together.
- **Proxima Cen b.** No paper in the archive measures its radius, so Default Flag **refuses** and names the missing field. The composite row answers anyway, **5.49 g/cm³**, from a radius the archive *calculated* from the minimum mass.
- **ups And c (a compounding case).** The default set refuses for lack of a radius. The composite gives 13.19 g/cm³ from a true mass (McArthur et al. 2010) and a radius the archive calculated *from that same mass*: a density built on itself.

### Four-arm evaluation

40 frozen questions (15 density, 10 insolation or equilibrium temperature, 5 habitable zone, 5 provenance, 5 refusals). Ground truth comes from the archive's default row in the raw snapshot CSV, independent of Sanity and the model. Same model, step budget and compute tool for every arm; only retrieval differs. Model `gemini-3.7-flash`, version `3.7-flash-08-2026`.

[SCREENSHOT: docs/screenshots/08-eval-table.png — the four-arm results table from /eval]

| Arm | Accuracy | Mixed-provenance rate | Correct refusals | Valid citations |
| --- | --- | --- | --- | --- |
| Structured agent (Sanity Context) | 98% (39/40) | **0%** (0/29) | **5/5** | 98% |
| Semantic search | 93% (37/40) | 3% (1/32) | 3/5 | 100% |
| Keyword (BM25) | 98% (39/40) | 3% (1/31) | 4/5 | 100% |
| No content | 45% (18/40) | 35% (7/20) | 3/5 | 0% |

**What the numbers say, plainly:**
- **Structured agent:** never mixed papers, and refused all five questions the data can't support.
- **Search baselines:** they read the same *structured* documents, where each parameter set is one self-contained document, and they mixed far less than I expected: 3%. Their failure was different. Where the default set can't answer, they quietly answered from *another paper's* set instead of saying so. That's a provenance error the mixed-provenance metric doesn't count.
- **No content:** the model mixed or invented its inputs 35% of the time.
- **The structured agent's one miss** was an answer its own output guard withheld.

### Why it's new

Plenty of agents surface contradictions between sources. This one **prevents** a specific, measurable error, mixing values from different papers into one derived number, and **measures** how often each retrieval approach makes it. Astronomy's per-paper parameter sets make the error checkable: every input value an arm used is matched back to the snapshot rows.

## Demo

[VIDEO: upload media/default-flag-final.mp4 (2:59, male voiceover, captions burned in; media/default-flag-final.srt alongside) and embed the YouTube link here]

Judge path:
1. Click **Density of Kepler-139 d?** and read the answer and its provenance strip.
2. Turn on **What the composite table would give**.
3. Click **Density of Proxima Cen b?** and get a refusal that names the missing field.
4. Open `/eval` for the four-arm table.
5. Open `/how-it-works` for the Knowledge Base section.

[SCREENSHOT: docs/screenshots/01-home-chips.png — first screen: three example chips, no login]

[SCREENSHOT: docs/screenshots/02-answer-provenance.png — live answer with the provenance strip: planet, parameter set id, paper, mass kind, snapshot checksum]

[SCREENSHOT: docs/screenshots/03-composite-toggle.png — "What the composite table would give" for Kepler-139 d: every input with its reference]

[SCREENSHOT: docs/screenshots/05-refusal-and-composite.png — Proxima Cen b: polite refusal, while the composite row answers from a calculated radius]

[SCREENSHOT: docs/screenshots/04-trace.png — trace panel: MCP tools discovered at runtime, GROQ queries, Knowledge Base reads, compute output, guard result]

[SCREENSHOT: docs/screenshots/11-mobile-home.png — mobile layout]

The other pages:
- `/planet/<slug>` puts every published parameter set side by side.
- `/eval` has a drill-down per question.
- `/how-it-works` has the endpoints, schema, snapshot checksums and the Knowledge Base evidence.

Every page has loading states and a banner naming the failing component (Sanity Context, dataset or model), never a silent fallback. The agent API is rate-limited.

## Code

https://github.com/unicorn-9-spec/default-flag (README with CI badge)

- `ingest/`: verify (SHA-256 manifests) → select → normalise → import. Snapshot files live in the repo; a second run makes zero changes.
- `agent/`:
  - `physics.ts`: density, insolation, T_eq, Kopparapu 2014 habitable zone, 10,000 seeded split-normal Monte Carlo draws;
  - `compute` and `composite_counterfactual` tools;
  - the output guard;
  - the MCP wiring.
- `web/`: the Next.js site.
- `eval/`: questions, truth, four arms, scoring, results.

CI runs on every push:
- snapshot checksums;
- an ingest determinism check;
- typecheck and lint;
- 38 unit tests, including physics against the archive's own insolation and temperature columns, guard tests and the offline evaluation subset;
- GROQ validation (zero violations);
- the Knowledge Base budget (≤ 150);
- the build;
- Playwright plus axe-core on the judge path, desktop and mobile.

**Code computes, the model explains.** The output guard is code, not prompt. It rejects an answer if:
- any number in it doesn't appear in a dataset or compute result from that turn (Knowledge Base text is never accepted as a number source);
- any document id or Knowledge Base path it cites wasn't read that turn;
- any quote isn't exact.

It retries once with the list of violations, then withholds the answer.

### What didn't work (from the build log)

- **The spec's premise was wrong on real data.** I assumed composite radii would contradict default radii; across 6,375 planets they never do, because the archive keeps the default value whenever it has one. The real mixing is gap-filling (1,573 calculated radii) and minimum-mass to true-mass swaps (100 planets).
- **My first flagship, HD 10180 c, fell apart under checking.** Its composite mass carries a limit flag with no uncertainties, and it has no radius at all.
- **The spec's dotted document ids** (`pset.k2-18-b.<ref>`) would have made every document private: Sanity serves ids containing a dot only to authenticated users.
- **Context's dataset mode stayed "Not ready" until a Studio was deployed.** `sanity schema deploy` alone wasn't enough.
- **The endpoint name was auto-filled from its title** (`default-flag-data`), and it can't be changed.
- **Context allows one source per dataset**, so the two planned Knowledge Base queries became one.
- **My own output guard rejected correct answers three times.** It read "16th–84th percentile" ordinals as unsourced numbers, then rejected "1240" as a rounding of 1244. Each fix came with a regression test. The first evaluation run is kept in the repo next to the rerun.
- **A stale `next start`** served HTML pointing at deleted CSS, and my accessibility test "passed" on the unstyled page.

### Known limitations

- **Selection:** 31 planets and 129 parameter sets, chosen by explicit rules (`ingest/data/selection.json`), not a population study.
- **Albedo:** fixed Bond albedo of 0.3, a modelling assumption.
- **Habitable zone:** limits are extrapolated below 2600 K (TRAPPIST-1), and the answer says so.
- **Limit flags:** the archive's limit-flag sign convention isn't defined in the documentation I snapshotted, so any flagged value is refused.
- **Prose claims:** the guard checks numbers, ids and quotes, not free-prose claims. One live answer added "detected via radial velocity", which is true but came from the model, not a tool.

## How I Used Sanity

**Structured content.** The archive snapshot is modelled so that provenance is a property of the data, not of the prompt:

[SCREENSHOT: docs/screenshots/10-schema-snapshots.png — schema and snapshot checksums from /how-it-works]

- `planet`: references to its `parameterSets`, its `defaultParameterSet`, and a `compositeSnapshot` holding every composite value with its reference, or "Calculated Value".
- `parameterSet`: one archive row: values with asymmetric errors and the archive's limit flag, `massKind` (Mass or M·sin i), and the stellar solution published *with that row*.
- `stellarSolution`, `publication`, `star`.
- `snapshot`: raw file, SHA-256, row count, retrieval time.
- `constant` / `threshold` / `hzLimit`: each with its source and the location within it.
- `derivedAnswer`: every input references its parameter set.

Studio validation and CI GROQ checks enforce one default per planet and single-set inputs for every derived answer. Document ids are deterministic and hyphenated, so the dataset stays anonymously readable.

**Sanity Context: two MCP endpoints**, because an endpoint serves one mode:
- **`default-flag-data`** (dataset/GROQ mode over `production`). The agent discovers its tools with `tools/list` at runtime and gets `initial_context`, `schema_explorer`, `groq_query` and `array_field_reader`. It uses them to find the planet and list its parameter sets. It writes GROQ like `*[_type == "planet" && name match "Kepler-139*"]{defaultParameterSet, "sets": parameterSets[]->{_id, defaultFlag, "paper": publication->citation}}`. It then calls the local `compute(setId, quantity)` tool, which can only read that one set.
- **`defaultflag-kb`** (Knowledge Base mode, Knowledge Base `kbhX0D4yDJok`), exposing `initial_context`, `knowledge_base_search` and `knowledge_base_read`. It is pointed at:
  - one GROQ query that gives every planet two documents, its default parameter set and its composite row, with matching field names (62 documents);
  - six archive documentation pages, uploaded as files: the default-set FAQ, how the composite table is calculated, the table overview, the column definitions, the acknowledgement page, and the DOI page.

  That's 68 documents against the 150 budget, checked in CI. The agent searches it, then reads entries by path, resolved at runtime because paths change on rebuild. It uses them to explain the rules: why the default set governs, and what a minimum mass means. It never takes a planet value from it.

**The Knowledge Base conflict.** For Kepler-139 d the two documents disagree: 4.658 M⊕ (M·sin i, Weiss et al. 2024, the default) against 2 M⊕ (Lammers & Winn 2025, composite).

**Context did not raise it in the Issues tab.** The Knowledge Base Purpose states the rule: "the self-consistent single-source set governs; composite values are recorded only as explicitly labelled alternatives". The build applied it directly. The planet entries hold a "Default parameter sets (preferred for derived quantities)" table and a separate "Composite table (mixed-source alternatives)" table, and say outright that Kepler-139 d's composite mass differs from its default.

[IMAGE: web/public/conflict/1-sources.png — Knowledge Base source: one GROQ query over production, 62 documents]

[IMAGE: web/public/conflict/2-entry.png — the built entry: default sets and composite alternatives in separate tables; Kepler-139 d's disagreement stated]

[SCREENSHOT: docs/screenshots/09-how-it-works-kb.png — the Knowledge Base section on /how-it-works]

**The answer that changed.** Before that source existed, the Knowledge Base held only methodology and could say nothing about Kepler-139 d. Now, asked "Which mass should I use for Kepler-139 d, and why does the composite table give a different one?", the agent answers:
- 4.66 M⊕ from Weiss et al. 2024;
- the composite's 2 M⊕ comes from a different paper;
- citing `kb:parameter_sets/default`.

The computed density stays 5.29 g/cm³, by design: numbers come only from the dataset and deterministic code.

**Where the advantage comes from.** `knowledge_base_search` is itself keyword (BM25) search, so the structured agent's edge over the BM25 baseline isn't better Knowledge Base retrieval. It comes from GROQ over typed documents plus a compute tool that can only read one parameter set.

## Sanity Project Details

- **Project ID:** `0eu544dk`
- **Dataset:** `production` (public read, no token needed)
- **Public GROQ query:** see `docs/PUBLIC_QUERY.md` for the full URL (the first five planets and their default papers)
- **Hosted Studio:** https://default-flag.sanity.studio
- **Knowledge Base:** `kbhX0D4yDJok`
- **Context endpoints:** `default-flag-data` (dataset mode) and `defaultflag-kb` (Knowledge Base mode)

No login anywhere on the demo site.

## Agent Session

[AGENT SESSION: export this Claude Code session, scan it with `node scripts/scan-secrets.mjs <file>`, upload at https://dev.to/agent_sessions/new, slice the key parts (verification pass, premise check on real data, guard false positives, Knowledge Base build), click Make Public, and embed it here]

### Data sources and licences

- NASA Exoplanet Archive: Planetary Systems (doi:10.26133/NEA12) and Planetary Systems Composite Parameters (doi:10.26133/NEA13) tables, retrieved 2026-10-03, snapshot checksums in the repo.
- Kopparapu et al. 2014 (habitable-zone coefficients, Table 1).
- Rogers 2015 (1.6 R⊕ rocky threshold).
- IAU 2015 Resolution B3 and IAU 2012 Resolution B2 (nominal solar constants, astronomical unit).

> This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.
