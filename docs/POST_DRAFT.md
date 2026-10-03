---
title: "Default Flag: an exoplanet agent that won't mix papers"
tags: sanitychallenge, ai, astronomy, agents
---

*Path One: Ship an Agent That Queries Real Content.*

**One-line pitch:** ask for an exoplanet's density, insolation, temperature or habitable-zone status, and get an answer computed from one self-consistent published parameter set, next to what mixing several papers would have said instead.

**Demo:** <DEMO_URL> · **Code:** https://github.com/unicorn-9-spec/default-flag · **Sanity project ID:** `<PROJECT_ID>` (dataset `production`, public)

<!-- RESULTS_TABLE: paste eval/results/<date>.md table here after the full run -->

## What I Built

The NASA Exoplanet Archive keeps every published solution for a planet as its own row and flags one as the default. It also publishes a composite table with one row per planet, filled parameter by parameter from whichever paper its rules pick. The archive itself calls that table "a more complete, though not necessarily self-consistent, set of parameters".

Most answers you'll find online quietly use that composite row. Default Flag does not. It computes every derived number from one parameter set, with the stellar values published alongside it, and shows the composite answer only as a labelled counterfactual:

- **Kepler-139 d.** Weiss et al. 2024 gives a density of 5.29 g/cm³. Their mass is M·sin i, which the archive calls a lower limit, so the density is a lower limit. The composite row swaps in a true mass from Lammers & Winn 2025 and gives 2.40 g/cm³: half the value, from two papers that never published together.
- **Proxima Cen b.** No paper in the archive measures its radius, so Default Flag refuses: "Proxima Cen b has no measured radius in the archive, so its density can't be computed." The composite row happily answers 5.49 g/cm³, using a radius the archive *calculated* from the minimum mass with a mass–radius relation.
- **HD 10180 c.** The composite's best mass is 2,741.6 M⊕ against the default's 13.2 M⊕ (M·sin i). That 2,741.6 carries the archive's limit flag and has no uncertainties. Default Flag treats it as what it is, a limit, not a measurement.

## Demo

Three chips on the first screen: *Density of Kepler-139 d?*, *Is TRAPPIST-1 e in the habitable zone?*, *Density of Proxima Cen b?*

Under each answer:
- a provenance strip: planet, parameter set id, paper, default or not, mass kind, stellar source, snapshot checksum;
- a "What the composite table would give" toggle, listing every input with its reference;
- the full trace: Context tools discovered via `tools/list`, GROQ queries, Knowledge Base entries opened, compute outputs, guard result.

`/planet/<slug>` puts every published parameter set side by side with the default highlighted. `/eval` has the four-arm table. `/how-it-works` has the endpoints, schema, snapshot checksums and the Knowledge Base conflict before and after.

Video (2–3 min, captioned): <VIDEO_URL>

## Code

https://github.com/unicorn-9-spec/default-flag. CI runs on every push:
- snapshot checksums;
- an ingest determinism check;
- typecheck, lint and unit tests, including physics checks against the archive's own insolation and temperature columns;
- GROQ validation (zero violations);
- the Knowledge Base budget;
- the build;
- Playwright plus axe-core on the judge path.

## How I Used Sanity

**Structured content.** These are the document types:
- `planet`: with a `compositeSnapshot` holding every composite value and its reference, or "Calculated Value".
- `parameterSet`: one archive row.
- `stellarSolution`: the star values published with that row.
- `publication`.
- `snapshot`: raw file, SHA-256, rows, retrieval time.
- `constant` / `threshold` / `hzLimit`: each with its source and the location in it.
- `derivedAnswer`: each input references its set.

Studio validation and CI GROQ checks enforce one default per planet, and single-set inputs for every derived answer.

**Two Sanity Context endpoints**, because an endpoint serves one mode (attach both and the dataset wins):
- `defaultflag-data`: dataset/GROQ mode. Tools discovered at runtime: `initial_context`, `schema_explorer`, `groq_query`, `array_field_reader`.
- `defaultflag-kb`: Knowledge Base `kbhX0D4yDJok`, with `initial_context`, `knowledge_base_search` and `knowledge_base_read`. Sources: a GROQ query over the default sets, a GROQ query over the composite snapshots, and five archive documentation pages, 49 documents in total (CI keeps it ≤ 150).

**Knowledge Base conflict.** <BEFORE/AFTER SCREENSHOTS + which planet + Keep/Accept choice + the answer that changed>

Where the advantage comes from: the Knowledge Base's own search tool is BM25 keyword search, so the structured agent's edge over the BM25 baseline is not better KB retrieval. It is GROQ over typed documents plus a compute tool that can only read one parameter set.

The KB's Purpose states the rule: for derived quantities the default set governs, and composite values are a counterfactual. It rests on the archive's own words, not mine. The KB explains rules only; the output guard refuses to treat any number from it as a source.

**Public GROQ:** `https://<PROJECT_ID>.api.sanity.io/v2026-10-03/data/query/production?query=*[_type=="planet"][0...5]`

## Sanity Project Details

Project `<PROJECT_ID>`, dataset `production` (public read). No login anywhere on the site.

## Agent Session

<AGENT_SESSION_EMBED>

## Why it's new

Plenty of entries surface contradictions between sources. This one *prevents* a specific, measurable error, mixing values from different papers into one derived number, and measures how often each retrieval approach makes it. The mixed-provenance rate is the headline metric, and astronomy's per-paper parameter sets make it checkable: every input value can be matched back to the snapshot rows.

## What didn't work (from the build log)

- The spec's premise was wrong on real data. I assumed composite radii would contradict default radii; across 6,375 planets they never do. The archive keeps the default value whenever it has one. The real mixing is gap-filling (1,573 calculated radii) and minimum-mass to true-mass swaps (100 planets).
- My first flagship, HD 10180 c, fell apart under checking: its composite mass is a limit with no errors, and it has no radius at all.
- The spec's dotted document ids (`pset.k2-18-b.<ref>`) would have made every document private; Sanity serves ids with a dot only to authenticated users.
- Context's dataset mode needs `sanity schema deploy`, not a deployed Studio as the spec said.
- KB conflicts can't be resolved by typing an instruction; the UI offers only Keep or Accept.
- A stale `next start` served HTML pointing at deleted CSS, and my accessibility test "passed" on the unstyled page.

## Known limitations

- 22 planets chosen by explicit rules, not a population study.
- Fixed Bond albedo of 0.3.
- Habitable-zone limits are extrapolated below 2600 K (TRAPPIST-1), and the answer says so.
- The archive's limit-flag sign convention isn't documented in the pages I snapshotted, so any flagged value is refused.

## Data sources and licences

- NASA Exoplanet Archive Planetary Systems (doi:10.26133/NEA12) and Composite Parameters (doi:10.26133/NEA13) tables, retrieved 2026-10-03.
- Kopparapu et al. 2014; Rogers 2015; IAU 2015 B3 and 2012 B2.
- "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program."
