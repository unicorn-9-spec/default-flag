# Owner steps to submit

Everything that can be done from the code side is done. These steps need you, in this order. Each says how to check it worked.

Live demo: https://default-flag.vercel.app (no login). Until step 1 is done, asking a question shows a red banner naming the missing Sanity Context endpoint; the planet, evaluation and how-it-works pages already work.

## 1. Create the dataset Context endpoint (blocks the live agent)

In the Sanity Dashboard → Context app → create an MCP endpoint:

- **Name:** `defaultflag-data` (exactly; the code reads this name)
- **Source:** dataset `production` of this project. **No Knowledge Base source** on this endpoint: an endpoint with a dataset source serves dataset mode only and ignores any KB sources.
- No GROQ filter needed. The schema is already deployed.
- Grant: the same organization token as `defaultflag-kb` (`SANITY_ORGANIZATION_TOKEN`, Context Viewer).

Check: `node agent/scripts/probe.ts` prints a `data:` line listing tools (expect `initial_context, schema_explorer, groq_query, array_field_reader`).

Then run, from the repo root:

```bash
node scripts/finish.mjs
```

It caches the three chip answers, runs the full four-arm evaluation, reruns the tests and redeploys to Vercel, stopping at the first failure. Afterwards tell the agent so it can review the results and write them into the post.

## 2. Knowledge Base: add the DOI page, set the Purpose, rebuild

Knowledge Base `kbhX0D4yDJok` (endpoint `defaultflag-kb`).

1. Add a **Files** source: upload `ingest/data/raw/nea-docs/archive-dois.html` (it carries the table DOIs). Do not use a Website/URL source: it crawls the whole site.
2. Make the sources match `kb/sources.json`:
   - two Dataset sources with the two GROQ queries in that file;
   - Files: the six HTML pages listed there.
   That's 68 documents against the 150 budget, which CI checks.
3. Set the **Purpose** to the text in `kb/sources.json` → `purpose`. It carries the resolution rule, because conflicts can only be resolved with Keep or Accept.
4. Click **Build entries** and wait for "Entries up to date". Entries are never built automatically.

## 3. Resolve one real default-vs-composite conflict, with screenshots

After the build, open **Issues**. The two dataset sources disagree wherever the composite row swapped a value. The expected candidates are:

- **Kepler-139 d mass:** default 4.66 M⊕ (M·sin i, Weiss et al. 2024) vs composite 2.00 M⊕ (Lammers & Winn 2025). This is the flagship.
- **ups And c mass:** default M·sin i vs composite 4443.2 M⊕ (McArthur et al. 2010).
- Any HD 10180 c, Proxima Cen b or TOI-700 d issue.

For the chosen conflict:

1. Screenshot the issue → save as `web/public/conflict/1-before.png`.
2. Choose the option that keeps the **default parameter set's** value: *Keep the current entry* if the current entry is the default, otherwise *Accept the incoming claim*. Then **Resolve issue**.
3. Rebuild entries if prompted, then screenshot the resolved entry → `web/public/conflict/2-after.png`.
4. Optional third shot: the entry text before vs after, or `3-answer.png` showing the agent's explanation citing the resolved entry.

The how-it-works page shows every image in that folder automatically (redeploy with `node scripts/finish.mjs` or `vercel deploy --prod`).

**Be honest in the post about what changes.** The agent's numbers come from the dataset, so resolving the conflict changes the Knowledge Base explanation the agent quotes, not the computed number. If Context raises no issue at all, the spec's fallback applies: say so plainly in the post and point to the side-by-side comparison on `/planet/kepler-139-d`.

## 4. GitHub

The remote `unicorn-9-spec/default-flag` currently returns "Repository not found" for the GitHub account logged in on this machine (`syncaimain`). Restore access, or tell the agent the new remote. Then push. Local commits are waiting. CI needs the repository variable `SANITY_PROJECT_ID` (it was set on the old repo). The repo must be **public** for the submission.

## 5. Sanity trial expiry

The project is on a Growth trial. Read the expiry date in Manage → Plan and write it in `docs/REPORT.md`. If it expires before judging ends, the demo will break.

## 6. Video (2–3 minutes, captions)

Follow `docs/VIDEO_SCRIPT.md`.

## 7. Public agent session

Export the session. Before uploading through DEV's Agent Sessions uploader, scan it:

```bash
node scripts/scan-secrets.mjs path/to/exported-session.md
```

It checks the literal values of every credential in `.env.local` plus common token patterns, and prints only line numbers. Redact anything it finds, then set the session to Make Public.

## 8. Publish the DEV post

Start from `docs/POST_DRAFT.md`. Fill the remaining placeholders: the results table (from `eval/results/<date>.md` after step 1), the conflict screenshots, the video URL and the agent session embed. Tag `#sanitychallenge`, Path One template.
