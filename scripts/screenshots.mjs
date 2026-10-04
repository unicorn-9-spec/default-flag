// Captures the post's screenshots from the live site with Playwright.
//   node scripts/screenshots.mjs [baseUrl]
// Writes docs/screenshots/NN-name.png (committed; referenced from docs/POST_DRAFT.md).
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const BASE = process.argv[2] ?? 'https://default-flag.vercel.app'
const DIR = new URL('../docs/screenshots/', import.meta.url)
mkdirSync(DIR, { recursive: true })
const file = (name) => decodeURIComponent(new URL(name, DIR).pathname).replace(/^\/([A-Z]:)/, '$1')

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' })
const page = await context.newPage()
const shot = async (name, locator) => {
  if (locator) await locator.screenshot({ path: file(name) })
  else await page.screenshot({ path: file(name) })
  console.log('saved', name)
}
const waitLive = () => page.locator('article.card .tag.ok', { hasText: 'live' }).first().waitFor({ timeout: 90_000 })

// Home: chips on the first screen.
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await shot('01-home-chips.png')

// Live answer with provenance strip.
await page.getByRole('button', { name: 'Density of Kepler-139 d?' }).click()
await waitLive()
const card = page.locator('article.card').first()
await shot('02-answer-provenance.png', card)

// Composite toggle open.
await card.getByRole('switch', { name: 'What the composite table would give' }).check()
await shot('03-composite-toggle.png', card.locator('.composite'))

// Trace panel.
await card.locator('details.trace > summary').click()
await shot('04-trace.png', card.locator('details.trace'))

// Refusal and the composite that answers anyway.
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Density of Proxima Cen b?' }).click()
await waitLive()
const card2 = page.locator('article.card').first()
await card2.getByRole('switch', { name: 'What the composite table would give' }).check()
await shot('05-refusal-and-composite.png', card2)

// Every parameter set side by side.
await page.goto(BASE + '/planet/kepler-139-d', { waitUntil: 'networkidle' })
await shot('06-planet-parameter-sets.png', page.locator('.table-wrap').first())
await shot('07-planet-composite.png', page.locator('section.composite'))

// Evaluation table.
await page.goto(BASE + '/eval', { waitUntil: 'networkidle' })
await shot('08-eval-table.png', page.locator('.table-wrap').first())

// Knowledge Base section and schema.
await page.goto(BASE + '/how-it-works', { waitUntil: 'networkidle' })
const kbHeading = page.getByRole('heading', { name: /Knowledge Base conflict/ })
await kbHeading.scrollIntoViewIfNeeded()
await shot('09-how-it-works-kb.png', page.locator('main'))
await page.getByRole('heading', { name: 'Schema' }).scrollIntoViewIfNeeded()
await shot('10-schema-snapshots.png')

// Mobile layout.
const mobile = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'light' })
const m = await mobile.newPage()
await m.goto(BASE + '/', { waitUntil: 'networkidle' })
await m.screenshot({ path: file('11-mobile-home.png') })
console.log('saved 11-mobile-home.png')

await browser.close()
