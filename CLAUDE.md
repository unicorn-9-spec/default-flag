# Default Flag — build brief (Path One)

**Source of truth:** `Default Flag (Path One).md` in this directory. Read it end to end before writing code. This file is the operating brief; where the two disagree, the spec wins.

## What you own

A Path One agent that answers derived exoplanet questions from one self-consistent parameter set per planet, and shows the different answer that mixing values from several papers would give.

You own **only this directory**. Never read or write sibling folders (`../best-track`, `../folklore-lab`, …) — four other agents are working in them in parallel.

## Assigned ports — do not change

| Service | Port |
| --- | --- |
| Next.js dev | 3001 |
| Sanity Studio | 3334 |

## Toolchain

Node v24.12.0 (spec wants 22.12+), pnpm 12.8.1, pnpm workspaces. **Use pnpm, never npm** — the hard-linked shared store is what keeps five repos inside the disk budget.

## Non-negotiable ground rules

- **Check the current Sanity docs first.** Sanity Context and Knowledge Bases change fast and KBs are in beta. Do not code against remembered APIs.
- **Everything marked "Verify" in the spec is unconfirmed.** Confirm against live docs before relying on it.
- **Never invent facts.** No made-up data, IDs, citations or API fields. Every stored fact carries a source URL and retrieval date; every habitable-zone coefficient is checked against its paper.
- **Code computes, the model explains.** Deterministic code produces every number. Any number shown to a user must appear in a tool result from that turn.
- **Snapshot the data.** All external data to `ingest/data/raw/` with retrieval date + SHA-256. The app reads the snapshot stored in Sanity — no live archive queries at answer time.
- **Build log from day one.** `docs/BUILD_LOG.md`: prompts that worked, prompts that failed, where you got stuck, how you fixed it, what you cut. The DEV post is written from this file.
- **Secrets stay server-side.** Never commit tokens. Scan the transcript before making any agent session public.
- **Knowledge Base budget: 150 documents or fewer**, enforced by a script in CI.

## Definition of done — all four criteria at 5

| Criterion | What must be true |
| --- | --- |
| Sanity Context & structured content | Every derived answer uses inputs from one parameter set; mixed-provenance rate of 0% shown against higher baseline rates |
| Technical implementation | Snapshot data in repo, unit-tested formulas, Monte Carlo uncertainty, an output guard, four-arm evaluation in CI |
| Knowledge Bases | KB under 150 docs; a real default-vs-composite conflict resolved, and an answer that visibly changes because of it |
| Usability | No-login demo, three example chips, provenance strip, composite toggle, polite refusals, video |

## First moves

1. Read the spec fully.
2. Confirm every **Verify** item against current Sanity docs; record findings in `docs/BUILD_LOG.md`.
3. Snapshot the parameter sets before writing any formula code.
4. Scaffold the pnpm workspace, then make your first commit.
