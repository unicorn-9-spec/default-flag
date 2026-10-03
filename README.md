# Default Flag

[![CI](https://github.com/unicorn-9-spec/default-flag/actions/workflows/ci.yml/badge.svg)](https://github.com/unicorn-9-spec/default-flag/actions/workflows/ci.yml)

**An exoplanet agent that answers derived questions from one self-consistent parameter set per planet, and shows what mixing values from several papers would have said instead.**

The NASA Exoplanet Archive keeps one row per planet per paper and flags one as the default. Its composite table keeps one row per planet and fills each value from whichever reference its rules pick, which the archive itself describes as "a more complete, though not necessarily self-consistent, set of parameters". Default Flag answers from the default set (or a paper you name), computes every number in code, and puts the composite answer next to it as a labelled counterfactual.

| Question | One paper (default set) | Composite table |
| --- | --- | --- |
| Density of Kepler-139 d | 5.29 g/cm³ (Weiss et al. 2024; mass is M·sin i, so a lower limit) | 2.40 g/cm³ (mass from Lammers & Winn 2025, radius from Weiss et al. 2024) |
| Density of Proxima Cen b | Refuses: no measured radius | 5.49 g/cm³, from a radius the archive *calculated* from the minimum mass |
| Insolation of TOI-700 d | Refuses: no stellar temperature in that paper | 0.81 S⊕, mixing Pass et al. 2026 and Gilbert et al. 2023 |

Path One entry for the Sanity Challenge on DEV (`#sanitychallenge`).

## How it works

- **Sanity Content Lake** holds a snapshot of the archive: 22 planets, 97 per-paper parameter sets, their stellar solutions and publications, each planet's composite row with the reference behind every value, and hand-checked constants and habitable-zone limits with sources. Dataset `production` is publicly readable.
- **Sanity Context, two MCP endpoints.** `defaultflag-data` (dataset/GROQ mode) for structured facts and `defaultflag-kb` (Knowledge Base mode, `kbhX0D4yDJok`) for the archive's own rules. Tools are discovered with `tools/list` at runtime.
- **Agent** (`agent/`): Vercel AI SDK + Gemini (`gemini-3.8-flash`). The model finds the planet and its parameter sets through Context, then calls `compute(setId, quantity)`, which reads exactly one set and the stellar solution published with it. `composite_counterfactual` runs the same physics on the composite row.
- **Code computes, the model explains.** Density, insolation, equilibrium temperature and habitable-zone status (Kopparapu et al. 2014) with 10,000 seeded Monte Carlo draws from split-normal errors. An output guard rejects any answer containing a number no tool returned, an id that was not read, or an inexact quote; it retries once, then withholds the answer.
- **Evaluation** (`eval/`): 40 frozen questions, ground truth from the raw CSV, four arms (structured agent, semantic search, BM25, no content) with the same model and compute tool. Metrics: accuracy, mixed-provenance rate, correct refusals, valid citations. Results: [`eval/results/`](eval/results/) and the site's `/eval` page.

## Repository

```
studio/   Sanity Studio: schema + validation (sanity schema deploy)
web/      Next.js App Router: /, /planet/[slug], /eval, /how-it-works, /api/ask
agent/    agent loop, MCP wiring, physics.ts, compute tools, output guard, prompts
ingest/   verify -> select -> normalise -> import; data/raw snapshots with SHA-256 manifests
eval/     questions.json, truth.ts, arms, scoring, runner, results
kb/       Knowledge Base source list (checked against the 150-document budget in CI)
docs/     BUILD_LOG.md
```

## Run it

Node 22.12+ and pnpm. Copy `.env.local.example` to `.env.local` and fill it in.

```sh
pnpm install
pnpm test              # unit tests + offline evaluation subset
pnpm check:dataset     # GROQ validation: one default per planet, single-set derived answers
pnpm check:kb          # Knowledge Base sources <= 150
pnpm dev:web           # http://localhost:3001
pnpm dev:studio        # http://localhost:3334
pnpm ingest            # verify snapshot -> select -> normalise -> import (a second run reports 0 changes)
pnpm eval              # full four-arm evaluation (uses the model API)
pnpm test:e2e          # Playwright judge path + axe-core
```

Public GROQ (no token): `https://<projectId>.api.sanity.io/v2026-10-03/data/query/production?query=*[_type=="planet"][0...5]`

## Data sources and citations

- NASA Exoplanet Archive, Planetary Systems table ([doi:10.26133/NEA12](https://doi.org/10.26133/NEA12)) and Planetary Systems Composite Parameters table ([doi:10.26133/NEA13](https://doi.org/10.26133/NEA13)), retrieved 2026-10-03. Snapshot files, row counts and SHA-256 checksums: `ingest/data/raw/nea-tables/MANIFEST.tsv`. Archive reference: Christiansen et al. (2025), *Planetary Science Journal*.
- Archive documentation pages (Knowledge Base sources): `ingest/data/raw/nea-docs/`.
- Kopparapu et al. 2014, ApJL 787, L29 (arXiv:1404.5292), Table 1: habitable-zone coefficients (cited, not redistributed).
- Rogers 2015, ApJ 801, 41 (arXiv:1407.4457): 1.6 R⊕ rocky threshold.
- IAU 2015 Resolution B3 and IAU 2012 Resolution B2: nominal solar effective temperature, solar radius, astronomical unit.
- Every planet value cites its original paper; see each parameter set's publication.

> This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.

## Known limitations

- 22 planets, chosen by the rules in `ingest/select.ts` (reasons in `ingest/data/selection.json`), not a population study.
- Bond albedo is fixed at 0.3 for every planet, a modelling assumption.
- Habitable-zone limits are extrapolated outside 2600–7200 K (e.g. TRAPPIST-1, 2566 K), and the answer says so.
- The archive's limit-flag sign convention is not defined in the documentation we snapshotted, so any value with a non-zero flag is treated as "not a measurement" and refused.
- Earth's mean density (5.514 g/cm³) is taken from the spec; the NASA fact sheet could not be fetched from the build machine to re-check it.
