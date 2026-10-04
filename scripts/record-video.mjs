// Records the judge-path walkthrough of the live site with Playwright.
//   node scripts/record-video.mjs [baseUrl]
// Output (gitignored): media/default-flag-walkthrough.webm, .mp4 (if ffmpeg is on PATH) and .srt.
// Captions are burned into the page (a fixed caption bar) and also written as an .srt.
// Silent: Playwright records no audio. Narration text follows docs/VIDEO_SCRIPT.md.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { synth } from './tts.mjs'

const BASE = process.argv[2] ?? 'https://default-flag.vercel.app'
const REPO = 'https://github.com/unicorn-9-spec/default-flag'
const OUT = new URL('../media/', import.meta.url)
const TMP = new URL('../media/.raw/', import.meta.url)
mkdirSync(TMP, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP.pathname.replace(/^\/([A-Z]:)/, '$1'), size: { width: 1280, height: 720 } },
  colorScheme: 'light',
})
// Caption bar that survives navigation.
await context.addInitScript(() => {
  const mount = () => {
    if (document.getElementById('__cap')) return
    const el = document.createElement('div')
    el.id = '__cap'
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', maxWidth: '1100px', width: 'max-content',
      background: 'rgba(15,16,20,0.88)', color: '#fff', font: '600 21px/1.4 system-ui, Segoe UI, sans-serif',
      padding: '10px 18px', borderRadius: '8px', zIndex: 2147483647, textAlign: 'center', display: 'none',
    })
    document.body.appendChild(el)
    window.__setCaption = (t) => { el.textContent = t; el.style.display = t ? 'block' : 'none' }
    if (window.__pendingCaption) window.__setCaption(window.__pendingCaption)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})

const page = await context.newPage()
const t0 = Date.now()
const srt = []
let current = null

async function caption(text, minMs) {
  const now = Date.now() - t0
  if (current) srt.push({ ...current, end: now })
  current = text ? { start: now, text } : null
  await page.evaluate((t) => { window.__pendingCaption = t; window.__setCaption?.(t) }, text ?? '')
  // Hold each caption for its spoken line (male TTS voice, see tts.mjs) plus a short pause,
  // so scripts/voiceover.mjs can lay the voice in without overlaps.
  const voice = text ? synth(text).seconds * 1000 + 450 : 0
  await page.waitForTimeout(Math.max(voice, minMs ?? 0))
}
async function go(path) {
  await page.goto(path.startsWith('http') ? path : BASE + path, { waitUntil: 'networkidle' })
  if (current) await page.evaluate((t) => { window.__pendingCaption = t; window.__setCaption?.(t) }, current.text)
}
async function scrollTo(locator) {
  await locator.first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  await page.waitForTimeout(900)
}
async function waitLive(timeoutMs = 75_000) {
  await page.locator('article.card .tag.ok', { hasText: 'live' }).first().waitFor({ timeout: timeoutMs }).catch(() => {})
}

// 1. One planet, many papers.
await go('/planet/kepler-139-d')
await caption('Kepler-139 d has ten published parameter sets in the NASA Exoplanet Archive. The archive flags one as the default: Weiss et al. 2024.')
await scrollTo(page.locator('tr.default'))
await caption('Each row is computed from that paper’s own values only. The default set gives a density of 5.29 g/cm³.')
await scrollTo(page.getByRole('heading', { name: 'What the composite table would give' }))
await caption('The archive’s composite table mixes papers: radius from Weiss et al. 2024, mass from Lammers & Winn 2025.')
await caption('The archive itself calls that table “not necessarily self-consistent”.', 3500)

// 2. Ask the agent.
await go('/')
await caption('Default Flag answers from ONE parameter set. Three example questions, no login.', 3800)
await page.getByRole('button', { name: 'Density of Kepler-139 d?' }).click()
await caption('A cached answer appears instantly while the live agent runs: it reads Sanity Context (dataset + Knowledge Base) over MCP…', 6000)
await waitLive()
await scrollTo(page.locator('article.card').first())
await caption('Live answer: 5.29 g/cm³ from Weiss et al. 2024. The mass is a minimum mass, so the density is a lower limit.')
await scrollTo(page.getByLabel('Provenance').first())
await caption('The provenance strip names the parameter set, the paper, the mass kind and the snapshot checksum.')
const toggle = page.getByRole('switch', { name: 'What the composite table would give' }).first()
await scrollTo(toggle)
await toggle.check()
await page.waitForTimeout(600)
await scrollTo(page.locator('.composite').first())
await caption('Flip the toggle: the composite row gives 2.40, less than half, from two papers that never published together.')

// 3. Refusal.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
await page.getByRole('button', { name: 'Density of Proxima Cen b?' }).click()
await caption('Proxima Cen b: no paper in the archive measures its radius…', 4500)
await waitLive()
await scrollTo(page.locator('article.card .refusal').first())
await caption('…so Default Flag refuses politely and names the missing field.')
const toggle2 = page.getByRole('switch', { name: 'What the composite table would give' }).first()
if (await toggle2.count()) {
  await scrollTo(toggle2)
  await toggle2.check()
  await page.waitForTimeout(600)
  await scrollTo(page.locator('.composite').first())
  await caption('The composite table answers anyway: 5.49 g/cm³, from a radius the archive CALCULATED from the mass. Never measured.')
}

// 4. Trace.
const trace = page.locator('details.trace > summary').first()
await scrollTo(trace)
await trace.click()
await page.waitForTimeout(500)
await caption('Every answer shows its trace: MCP tools discovered at runtime, GROQ queries, Knowledge Base entries read, compute output.')
await caption('A code guard rejects any number that no tool returned in that turn.', 3800)

// 5. Knowledge Base.
await go('/how-it-works')
await scrollTo(page.getByRole('heading', { name: /Knowledge Base conflict/ }))
await caption('The Knowledge Base reads the default set and the composite row for every planet. For Kepler-139 d they disagree.')
await scrollTo(page.locator('figure img').first())
await caption('Context applied the rule in its Purpose at build time: default set preferred, composite kept as a labelled alternative.')
await scrollTo(page.locator('figure img').nth(1))
await caption('No issue was raised to click on, and we say so. The agent now uses this entry to explain which mass to trust.')

// 6. Evaluation.
await go('/eval')
await scrollTo(page.locator('table').first())
await caption('Forty frozen questions, four arms, same model and the same compute tool. Only retrieval differs.')
await caption('Structured agent: 0% mixed provenance and 5 of 5 correct refusals. With no content, the model mixed or invented inputs 35% of the time.')

// 7. Schema and repo.
await go('/how-it-works')
await scrollTo(page.getByRole('heading', { name: 'Schema' }))
await caption('The schema, snapshot checksums and public GROQ endpoint are on the how-it-works page.')
await go(REPO)
await caption('The code is public, with CI. Default Flag: one paper per answer.', 4500)
await caption(null, 800)

await context.close()
await browser.close()

// Collect the recording.
const raw = readdirSync(TMP).find((f) => f.endsWith('.webm'))
const webm = new URL('default-flag-walkthrough.webm', OUT)
renameSync(new URL(raw, TMP), webm)
rmSync(TMP, { recursive: true, force: true })
const ts = (ms) => new Date(ms).toISOString().slice(11, 23).replace('.', ',')
writeFileSync(new URL('default-flag-walkthrough.srt', OUT), srt.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'))
const path = (u) => decodeURIComponent(u.pathname).replace(/^\/([A-Z]:)/, '$1')
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path(webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', path(new URL('default-flag-walkthrough.mp4', OUT))], { stdio: 'inherit' })
console.log(`recorded ${((Date.now() - t0) / 1000).toFixed(0)} s; ${srt.length} captions; mp4 ${ff.status === 0 ? 'written' : 'not written (ffmpeg missing or failed)'}`)

// Narration sheet for recording a voiceover against the picture.
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(1, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
writeFileSync(new URL('narration.txt', OUT), `Default Flag walkthrough: narration cues (read each line when its time comes)\n\n${srt.map((c) => `${mmss(c.start)}  ${c.text}`).join('\n')}\n`)
console.log('narration cues: media/narration.txt')
