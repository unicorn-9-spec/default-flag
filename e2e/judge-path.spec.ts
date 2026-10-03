import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The judge path from the spec. Chip answers come from the committed cached examples
// when the live run is unavailable (e.g. CI without model credentials), and the page
// says so in a banner; either way the provenance strip and toggle must work.

async function seriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)
}

test('1-2: density chip shows an answer, provenance strip and composite toggle', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Density of Kepler-139 d?' })).toBeVisible()
  expect(await seriousViolations(page)).toEqual([])

  await page.getByRole('button', { name: 'Density of Kepler-139 d?' }).click()
  const card = page.locator('article.card').first()
  await expect(card).toBeVisible({ timeout: 60_000 })
  const provenance = card.getByLabel('Provenance')
  await expect(provenance).toContainText('Kepler-139 d')
  await expect(provenance).toContainText('Weiss et al. 2024')

  const toggle = card.getByRole('switch', { name: 'What the composite table would give' })
  await toggle.check()
  await expect(card.locator('.composite')).toContainText('Lammers & Winn 2025')
  expect(await seriousViolations(page)).toEqual([])
})

test('3: refusal chip names the missing field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Density of Proxima Cen b?' }).click()
  const card = page.locator('article.card').first()
  await expect(card).toContainText(/radius/i, { timeout: 60_000 })
  await expect(card.locator('.refusal').first()).toContainText('radius')
})

test('4: evaluation page shows the four-arm table', async ({ page }) => {
  await page.goto('/eval')
  await expect(page.getByRole('heading', { name: 'Four-arm evaluation' })).toBeVisible()
  for (const arm of ['Structured agent', 'Semantic search', 'Keyword (BM25)', 'No content']) {
    await expect(page.getByRole('row', { name: new RegExp(arm.replace(/[()]/g, '\\$&')) })).toBeVisible()
  }
  expect(await seriousViolations(page)).toEqual([])
})

test('5: how-it-works shows endpoints, conflict section and snapshots', async ({ page }) => {
  await page.goto('/how-it-works')
  await expect(page.getByText('defaultflag-kb')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Knowledge Base conflict/ })).toBeVisible()
  await expect(page.getByText('nea-ps.csv').first()).toBeVisible()
  expect(await seriousViolations(page)).toEqual([])
})

test('planet page lists every parameter set with the default highlighted', async ({ page }) => {
  await page.goto('/planet/kepler-139-d')
  await expect(page.getByRole('heading', { name: 'Kepler-139 d' })).toBeVisible()
  await expect(page.locator('tr.default')).toHaveCount(1)
  expect(await seriousViolations(page)).toEqual([])
})

test('keyboard: chips and the ask box are reachable with Tab', async ({ page }) => {
  await page.goto('/')
  const focused: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    focused.push(await page.evaluate(() => document.activeElement?.textContent || (document.activeElement as HTMLInputElement | null)?.id || ''))
  }
  expect(focused).toContain('Density of Kepler-139 d?')
  expect(focused).toContain('q')
})
