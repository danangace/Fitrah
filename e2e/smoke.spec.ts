import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const TOKEN = 'e'.repeat(64)
const shot = (name: string) => `test-results/screens/${name}.png`

test('start, accounts, docs, workspace and chat (AC-B1 smoke)', async ({ page }) => {
  // Start: the link from `fitrah start` carries the token; it becomes a cookie and leaves the URL.
  await page.goto(`/?token=${TOKEN}`)
  await expect(page.getByText('Finance Iteration Tools, Review & Agent Hub')).toBeVisible()
  await expect(page).not.toHaveURL(/token=/)
  await page.screenshot({ path: shot('1-home') })

  // Accounts
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
  await expect(page.getByText('smoke@example.com')).toBeVisible()
  await page.screenshot({ path: shot('2-accounts') })

  // Docs: rendered markdown, table, mermaid, wiki-link
  await page.getByRole('button', { name: 'Docs' }).click()
  await page.getByRole('button', { name: 'README' }).click()
  await expect(page.getByRole('heading', { name: 'Smoke vault' })).toBeVisible()
  await expect(page.locator('.markdown table')).toBeVisible()
  await expect(page.locator('.markdown svg').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: shot('3-docs') })
  await page.getByRole('link', { name: 'Second note' }).click()
  await expect(page.getByRole('heading', { name: 'Second note' })).toBeVisible()

  // Workspace
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.getByPlaceholder('kelola-xyz').fill('smoke-feature')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByRole('heading', { name: 'smoke-feature' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('feat/tribe-2/smoke-feature ← origin/dev/tribe-2')).toBeVisible()

  // Chat with the fake agent: approval card → deny
  await page.getByRole('button', { name: 'New chat' }).click()
  await page.getByPlaceholder(/Message Claude/).fill('please touch a file')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Claude wants to use Bash')).toBeVisible()
  await expect(page.locator('main [title="needs approval"]').first()).toBeVisible()
  await page.screenshot({ path: shot('4-approval') })
  await page.getByRole('button', { name: 'Deny' }).click()
  await expect(page.getByText('The command was denied.')).toBeVisible()
  await expect(page.getByText('Denied: Bash')).toBeVisible()
  await expect(page.locator('aside [title="done"]').first()).toBeVisible()
  await page.screenshot({ path: shot('5-chat-done') })
})

test('a repo added in Settings can be used for a new workspace without reloading', async ({ page }) => {
  const { extraRepo } = JSON.parse(readFileSync(join(import.meta.dirname, '.state.json'), 'utf8')) as { extraRepo: string }
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Repos', exact: true }).click()
  await page.getByPlaceholder('~/Documents/Sekolahmu/Modularity/website-cf-monorepo').fill(extraRepo)
  await page.getByPlaceholder('origin/dev/tribe-2').last().fill('origin/main')
  await page.getByRole('button', { name: 'Add repo' }).click()
  await expect(page.getByText(extraRepo)).toBeVisible()
  await expect(page.getByText('Added extra-repo. It is ready for new workspaces.')).toBeVisible()

  // The repo row shows its state, and saving gives feedback.
  const row = page.getByTestId('repo-row').filter({ hasText: 'extra-repo' })
  await expect(row.getByText('Added', { exact: true })).toBeVisible()
  await expect(row.getByText('Ready · no setup script')).toBeVisible()
  await expect(row.getByRole('button', { name: 'Save repo' })).toBeDisabled()
  await row.locator('textarea').first().fill('echo ready')
  await expect(row.getByText('Unsaved changes')).toBeVisible()
  await row.getByRole('button', { name: 'Save repo' }).click()
  await expect(row.getByText('Saved', { exact: true })).toBeVisible()
  await expect(row.getByText('Ready · setup script')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/repo-feedback.png', fullPage: true })

  // Same page session, no reload: the new repo is selectable and usable.
  await page.locator('aside').getByRole('button', { name: 'New workspace' }).click()
  const repoName = extraRepo.split('/').pop() ?? ''
  const select = page.locator('select').first()
  await expect(select.locator('option')).toHaveCount(2)
  await select.selectOption({ label: repoName })
  await page.getByPlaceholder('kelola-xyz').fill('from-new-repo')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByText('feat/tribe-2/from-new-repo ← origin/main')).toBeVisible({ timeout: 20_000 })
})

test('a browser without the session sees how to connect', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText("This browser isn't connected to Fitrah")).toBeVisible()
  await expect(page.getByText('fitrah open --print', { exact: false })).toBeVisible()
  // A wrong token does not connect either.
  await page.goto('/?token=wrong')
  await expect(page.getByText("This browser isn't connected to Fitrah")).toBeVisible()
  await context.close()
})
