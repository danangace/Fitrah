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
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
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
  await page.locator('aside').getByRole('button', { name: 'New workspace', exact: true }).click()
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

test('Add a project by browsing to a folder, then edit its settings (AC-P1)', async ({ page }) => {
  const { extraRepo } = JSON.parse(readFileSync(join(import.meta.dirname, '.state.json'), 'utf8')) as { extraRepo: string }
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('button', { name: 'Add project' }).click()
  await page.getByRole('button', { name: /Browse folder/ }).click()
  await page.getByLabel('Folder path').fill(extraRepo)
  await page.getByLabel('Folder path').press('Enter')
  await expect(page.getByRole('button', { name: /Use this folder: extra-repo/ })).toBeVisible()
  await page.getByRole('button', { name: /Use this folder/ }).click()
  await expect(page.getByText('Base branch')).toBeVisible()
  await page.getByPlaceholder('feat/tribe-2/').fill('try/')
  await page.getByRole('dialog').getByRole('button', { name: 'Add project' }).click()

  // Lands on the project settings; the project is in the sidebar.
  await expect(page.getByRole('heading', { name: 'Project settings' })).toBeVisible()
  await expect(page.locator('aside').getByText('extra-repo')).toBeVisible()
  const row = page.getByTestId('repo-row')
  await expect(row.getByText('Added', { exact: true })).toBeVisible()
  await row.locator('textarea').first().fill('echo ready')
  await expect(row.getByText('Unsaved changes')).toBeVisible()
  await row.getByRole('button', { name: 'Save repo' }).click()
  await expect(row.getByText('Saved', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/project-settings.png', fullPage: true })
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

test('Settings → Workflows: create a workflow with fields (AC-F1)', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Workflows', exact: true }).click()
  await expect(page.getByRole('button', { name: /Planning/ })).toBeVisible()
  await page.getByRole('button', { name: 'New workflow' }).click()
  await page.getByPlaceholder('e.g. Planning').fill('Defect fix')
  await page.getByRole('button', { name: 'Add field' }).click()
  await page.getByLabel('Field label').last().fill('Ticket')
  await page.getByLabel('Field type').last().selectOption('link')
  await page.getByRole('button', { name: 'Add field' }).click()
  await page.getByLabel('Field label').last().fill('Found on')
  await page.getByLabel('Field type').last().selectOption('choice')
  await page.getByLabel('Choices').fill('dev, staging, prod')
  await page.getByRole('button', { name: '{Ticket}' }).click()
  await page.getByRole('button', { name: 'Create workflow' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Defect fix/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/workflows.png', fullPage: true })
})
