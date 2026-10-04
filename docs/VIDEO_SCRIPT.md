# Video script: Default Flag (target 2:30, captions on)

Follows the spec's judge path. Record at 1280×800 or larger, browser zoom 110%, light mode. Each line in quotes is both narration and caption.

| Time | On screen | Narration / caption |
| --- | --- | --- |
| 0:00–0:15 | `/planet/kepler-139-d`, scroll the parameter-set table | "Kepler-139 d has ten published parameter sets in the NASA Exoplanet Archive. The archive flags one as the default: Weiss et al. 2024." |
| 0:15–0:30 | Scroll to "What the composite table would give"; point at the mass row | "The archive's composite table mixes papers: radius from Weiss, mass from Lammers and Winn 2025. The archive itself calls that table 'not necessarily self-consistent'." |
| 0:30–0:55 | `/`, click **Density of Kepler-139 d?**; show answer and provenance strip | "Ask for its density. The agent finds the planet through Sanity Context, then computes from one parameter set only: 5.3 grams per cubic centimetre. The mass is a minimum mass, so it says the density is a lower limit." |
| 0:55–1:10 | Toggle **What the composite table would give** | "Flip the toggle: the composite row gives about 2.4, less than half, from two papers that never published together." |
| 1:10–1:30 | Click **Density of Proxima Cen b?** | "Proxima Cen b has no measured radius in any paper, so Default Flag refuses and names the missing field." |
| 1:30–1:40 | Toggle composite on Proxima | "The composite table answers anyway, with a radius the archive calculated from the mass. That number was never measured." |
| 1:40–1:55 | Open the **Trace** panel | "Every answer shows its trace: tools discovered from the MCP endpoints, the GROQ queries, the Knowledge Base entries read, and the deterministic compute output. A code guard rejects any number no tool returned." |
| 1:55–2:15 | `/how-it-works`, the conflict screenshots | "The Knowledge Base raised a conflict between the default and composite sources. We kept the default parameter set, the rule stated in the Knowledge Base purpose, and the explanation the agent quotes changed with it." |
| 2:15–2:30 | `/eval` table | "Across forty frozen questions, four arms with the same model: <read the four mixed-provenance rates from the table>." |
| 2:30–2:40 | `/how-it-works` schema, then the GitHub repo | "The schema, the snapshot checksums and the code are all public. Default Flag: one paper per answer." |

Before recording: run `node scripts/finish.mjs` so the chips answer live and `/eval` has results. Read every number from the screen on the day; do not script numbers that the live run might change.
