# Knowledge Base: the default-vs-composite conflict

Knowledge Base `kbhX0D4yDJok`, served by endpoint `defaultflag-kb`. Recorded 2026-10-05.

## What we set up

- **Sources:** one dataset source on `production` (62 documents) plus six archive documentation files.
  - The dataset query is `kb/query-combined.groq`.
  - It gives every planet two documents: its archive **default parameter set** and its **composite table** row.
  - Both use the same field names (`massEarth`, `radiusEarth`, `semiMajorAxisAu`, paper), so the two claims about one planet are directly comparable.
  - Context allows only one source per dataset, hence one query covering both document kinds.
- **Purpose** (the governing rule, since conflicts can only be resolved with Keep or Accept): *"Where a default parameter set disagrees with a composite or aggregated value, the self-consistent single-source set governs. Composite values are recorded only as explicitly labelled alternatives…"*

## What Context did

**No issue was raised in the Issues tab.** Instead, the rebuild applied the Purpose rule while writing entries:

- It created a planet catalogue: `planet_catalogue/mini_neptunes`, `planet_catalogue/rv_giants`, `planet_catalogue/terrestrial_habzone` and `planet_catalogue/transiting_giants`.
- Each entry has a **"Default parameter sets (self-consistent, preferred for derived quantities)"** table and a separate **"Composite table (mixed-source alternatives)"** table.
- For the flagship it states the disagreement explicitly: Kepler-139 d's composite mass (2 M⊕, Lammers & Winn 2025) differs from its default (4.658 M⊕, M sin i, Weiss et al. 2024), and it says to always use the default set for derived calculations.

The spec's fallback applies ("if Context raises no issue, show the conflict side by side from the data anyway and say plainly that the build did not flag it"). It is shown side by side on `/planet/kepler-139-d`, and in the Knowledge Base entry itself.

## The answer that changes

Before the dataset source was added, the Knowledge Base held only methodology entries (7 entries, no planet records). The agent could cite the general rule but nothing about Kepler-139 d specifically.

After the rebuild, asked *"Which mass should I use for Kepler-139 d, and why does the composite table give a different one?"*, the agent answered:

> You should use the default parameter set mass of 4.66 Earth masses from Weiss et al. 2024 [pset-kepler-139-d-weiss-et-al-2024]. The composite table reports a different mass of 2 Earth masses because it takes that value from a different publication, Lammers & Winn 2025. … self-consistent physical calculations should always use a single published default parameter set [kb:parameter_sets/default].

Every number in that answer was checked by the output guard against tool results from that turn. The full run, with its trace, is in `eval/cache/kb-explain-after.json`, which is gitignored; re-run it with the same question to reproduce.

**What does not change, by design:** the computed density (5.29 g/cm³). Numbers come only from the dataset endpoint and deterministic code; the Knowledge Base supplies the explanation and the rule.

## Also observed

- Entry paths changed on rebuild. The cached chip answer from before the rebuild had read `parameter_provenance`, which no longer exists; paths now include `parameter_sets/default` and `planet_catalogue/*`. The agent resolves paths at runtime through `initial_context` and `knowledge_base_search`, so nothing broke.
- 8 entries, from 68 source documents (62 + 6), against the 150-document budget.
