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

## Model provider — Google Gemini

This build uses Gemini, not Anthropic. The key is `GEMINI_API_KEY` in `.env.local`, loaded for you by `launch.ps1`.

- **Prefer the Vercel AI SDK over a provider-specific SDK.** The spec requires an MCP client to reach the Sanity Context endpoint, and the AI SDK gives you Gemini models plus MCP tool discovery in one place. Discover tools with MCP `tools/list` at runtime; never hardcode tool schemas.
- **Record the exact model name and version in every evaluation result**, as the spec requires. All arms of the evaluation must use the same model.
- **Verify** the current Gemini model IDs and the AI SDK provider package name against live docs before coding. Do not rely on remembered model names.
- The key format supplied does not match the usual Google AI Studio pattern, so make a single cheap call to confirm it authenticates before building anything on top of it. If it fails, stop and report rather than working around it.

## Findings from a sibling agent — re-verify cheaply, then rely on them

The `best-track` agent verified these against live Sanity docs on 2026-10-03. They are reported, not gospel: confirm each with one cheap check, then trust it. Do not spend a full research pass rediscovering them.

**The spec is wrong on two points:**

- Context **data mode needs a deployed schema** (`sanity schema deploy`), **not** a deployed Studio. The spec says Studio; that is incorrect.
- The Context **tool list in the spec is incomplete.** Data mode also exposes `schema_explorer` and `array_field_reader`. Discover tools at runtime with MCP `tools/list` regardless.

**Other confirmed behaviour:**

- An endpoint serves **one mode only.** Attach both a dataset and a Knowledge Base and the dataset silently wins. Use two separate endpoints.
- **Knowledge Base conflicts cannot be resolved by typing an instruction.** The UI offers only *Keep the current entry* or *Accept the incoming claim*. So encode your resolution rule in the Knowledge Base purpose text and choose the keep/accept option deliberately per conflict.
- The **150-document Knowledge Base cap is not in the docs** — only plan-level caps are documented. Keep the 150 budget and the CI check anyway; the spec asks for it and it costs nothing.
- Studio v6 requires **Node 22.12+** (confirmed in `sanity@6.17.0`).
- Knowledge Bases are beta and an **org admin must enable them** under Manage then Labs.

**Credentials you will need, now in `.env.local`:** `SANITY_ORG_ID` and `SANITY_ORGANIZATION_TOKEN` (an organization API token with **Context Viewer** permission). If they are blank, ask for them rather than guessing.

**Toolchain warning:** TypeScript resolves to **7.0.2**, a new major. Confirm Next.js and Sanity tolerate it; pin to 5.x if not.

## Reporting protocol — read this

Coordination happens through two files in this repository. You never read any
sibling project folder; that rule stands.

- **`docs/REPORT.md`** — you write. Append-only, newest at the bottom. Write an
  entry when you finish a meaningful step, hit a blocker, depart from the spec,
  or need a judgement call. Start each entry with a timestamp line, then
  `STATE:` (one line) and `BLOCKED_ON:` (`none`, or exactly what you need).
- **`docs/GUIDANCE.md`** — you read. Answers and sequencing arrive here. Check
  the tail before starting new work, and again after writing a blocked entry.

Rules that make this work:

- **Never inline long URLs, query strings or hashes in a report.** Line wrapping
  destroys them. Write them to a file and reference the path. A 743-character
  TAP query was already lost this way once.
- **Do not idle waiting for a reply.** Write the entry, then continue with
  anything unblocked. Only stop if genuinely blocked.
- **Append, never rewrite.** The exchange is part of the build-process record and
  gets read by judges, so an honest trail beats a tidy one.
- Both files are committed. Keep secrets out of them — reference variable names,
  never values.
