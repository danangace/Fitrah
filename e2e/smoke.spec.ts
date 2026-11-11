import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const TOKEN = 'e'.repeat(64)
const shot = (name: string) => `test-results/screens/${name}.png`

test('start, accounts, docs, workspace and chat (AC-B1 smoke)', async ({ page }) => {
  // Start: the link from `fitrah start` carries the token; it becomes a cookie and leaves the URL.
  await page.goto(`/?token=${TOKEN}`)
  await expect(page.locator('aside [title="Finance Iteration Tools, Review & Agent Hub"]')).toContainText('Fitrah')
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

  // Workspace: the small modal, Free chat, default agent → the first chat is ready
  await page.locator('aside').getByRole('button', { name: 'New workspace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await dialog.getByLabel('Workspace name').fill('smoke-feature')
  await expect(dialog.getByText('Branch feat/tribe-2/smoke-feature from origin/dev/tribe-2')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/create-workspace.png' })
  await dialog.getByRole('button', { name: /Create workspace/ }).click()
  await expect(page.getByRole('heading', { name: 'smoke-feature' })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('main header').getByText('feat/tribe-2/smoke-feature')).toBeVisible()
  await expect(page.getByText('Free chat')).toBeVisible()

  // Chat with the fake agent: approval card → deny
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
  await row.getByRole('button', { name: 'Save project' }).click()
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

test('Planning workflow: required fields, values shown, chat waits (AC-F2, AC-F4)', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('button', { name: 'New workspace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await dialog.getByLabel('Project').selectOption({ label: 'repo' })
  await dialog.getByLabel('Workspace name').fill('plan-kelola')
  await dialog.getByLabel('Type').selectOption({ label: 'Planning' })
  await expect(dialog.getByText('Fill in: PRD, Figma, Iteration, Module')).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Create workspace/ })).toBeDisabled()
  await dialog.getByLabel('PRD').fill('https://prd.example/kelola')
  await dialog.getByLabel('Figma').fill('https://www.figma.com/design/abc?node-id=1-2')
  await dialog.getByLabel('Iteration').fill('i-16')
  await dialog.getByLabel('Module').fill('kelola')
  await page.screenshot({ path: 'test-results/screens/create-workspace-planning.png' })
  await dialog.getByRole('button', { name: /Create workspace/ }).click()

  await expect(page.getByRole('heading', { name: 'plan-kelola' })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('main header').getByText('Planning', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'PRD ↗' })).toHaveAttribute('href', 'https://prd.example/kelola')
  await expect(page.getByText('i-16')).toBeVisible()
  // The chat is ready and waits for my first message (nothing sent).
  await expect(page.getByText('Say what Claude should do in this workspace.')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/workspace-planning.png' })
})
