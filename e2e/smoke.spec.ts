import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locator, type Page, expect, test } from '@playwright/test'

const TOKEN = 'e'.repeat(64)
const shot = (name: string) => `test-results/screens/${name}.png`

/** Pick an option in a shadcn / Base UI select: open the trigger, click the option in its popup. */
async function pick(page: Page, trigger: Locator, option: string) {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(trigger).toContainText(option)
}

test('start, accounts, docs, workspace and chat (AC-B1 smoke)', async ({ page }) => {
  // Start: the link from `fitrah start` carries the token; it becomes a cookie and leaves the URL.
  await page.goto(`/?token=${TOKEN}`)
  await expect(page.locator('aside [title="Fitrah: Finance Iteration Tools, Review & Agent Hub"]')).toContainText('Fitrah')
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

  // Back to the main sidebar
  await page.getByRole('button', { name: 'Back to Fitrah' }).click()

  // Workspace: the small modal, Free chat, default agent → the first chat is ready
  await page.getByRole('button', { name: 'New workspace in repo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await dialog.getByLabel('Workspace name').fill('smoke-feature')
  await expect(dialog.getByText('Branch feat/tribe-2/smoke-feature from origin/dev/tribe-2')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/create-workspace.png' })
  await dialog.getByRole('button', { name: /Create workspace/ }).click()
  await expect(page.getByRole('heading', { name: 'smoke-feature' })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('main header').getByText('feat/tribe-2/smoke-feature')).toBeVisible()
  await expect(page.getByText('Free chat')).toBeVisible()

  // Usage: nothing yet before the first message
  await expect(page.getByRole('button', { name: 'Usage' })).toContainText('after your first message')

  // Chat with the fake agent: approval card → deny
  await page.getByPlaceholder(/Message Claude/).fill('please touch a file')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByTestId('workspace-row-smoke-feature').getByLabel('Working')).toBeVisible()
  await page.screenshot({ path: shot('4a-working') })
  await expect(page.getByText('Claude wants to use Bash')).toBeVisible()
  // Sidebar row: the agent + model, and the "needs you" state
  const row = page.getByTestId('workspace-row-smoke-feature')
  await expect(row).toContainText('Claude Sonnet')
  await expect(row.locator('[title="needs approval"]')).toBeVisible()
  await expect(page.locator('main [title="needs approval"]').first()).toBeVisible()
  await page.screenshot({ path: shot('4-approval') })
  await page.getByRole('button', { name: 'Deny' }).click()
  await expect(page.getByText('The command was denied.')).toBeVisible()
  await expect(page.getByText('Denied: Bash')).toBeVisible()
  await expect(page.locator('aside [title="done"]').first()).toBeVisible()
  await page.screenshot({ path: shot('5-chat-done') })
  await expect(row.locator('[title="done"]')).toBeVisible()

  // Usage from the turn: status bar + card (like the Claude statusline / Orca)
  await expect(page.getByRole('button', { name: 'Usage' })).toContainText('82%')
  await expect(page.getByRole('button', { name: 'Usage' })).toContainText('46%')
  await page.getByRole('button', { name: 'Usage' }).click()
  await expect(page.getByTestId('usage-five_hour')).toContainText('82% used')
  await expect(page.getByTestId('usage-seven_day')).toContainText('Resets in 3d')
  await page.screenshot({ path: shot('6-usage') })
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
  await pick(page, page.getByLabel('Field type').last(), 'Link')
  await page.getByRole('button', { name: 'Add field' }).click()
  await page.getByLabel('Field label').last().fill('Found on')
  await pick(page, page.getByLabel('Field type').last(), 'Choice')
  await page.getByLabel('Choices').fill('dev, staging, prod')
  await page.getByRole('button', { name: '{Ticket}' }).click()
  await page.getByRole('button', { name: 'Create workflow' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  // Bottom-right alert confirms the save
  const toastAlert = page.getByRole('alert').filter({ hasText: 'Workflow created' })
  await expect(toastAlert).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/toast.png' })
  await toastAlert.getByRole('button', { name: 'Dismiss' }).click()
  await expect(toastAlert).toBeHidden()
  await expect(page.getByRole('button', { name: /Defect fix/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/workflows.png', fullPage: true })
})

test('Planning workflow: required fields, values shown, chat waits (AC-F2, AC-F4)', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.getByRole('button', { name: 'New workspace in repo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await pick(page, dialog.getByLabel('Project'), 'repo')
  await dialog.getByLabel('Workspace name').fill('plan-kelola')
  // The Type dropdown is a styled popup list; Esc closes only the list, not the dialog.
  await dialog.getByLabel('Type').click()
  const option = page.getByRole('option', { name: 'Planning', exact: true })
  await expect(option).toBeVisible()
  // The list is on top of the dialog (not hidden behind it): the option is what is under the pointer.
  await expect
    .poll(() => option.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
    }))
    .toBe(true)
  await page.screenshot({ path: 'test-results/screens/select-open.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(dialog).toBeVisible()
  await pick(page, dialog.getByLabel('Type'), 'Planning')
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
  // Each task value has its own row with the full link and a copy button.
  await expect(page.getByRole('link', { name: 'https://prd.example/kelola' })).toHaveAttribute('href', 'https://prd.example/kelola')
  await expect(page.getByRole('button', { name: 'Copy PRD' })).toBeVisible()
  await expect(page.getByText('i-16', { exact: true })).toBeVisible()
  // The chat is ready and waits for my first message (nothing sent).
  await expect(page.getByText('Say what Claude should do in this workspace.')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/workspace-planning.png' })
})

test('composer pickers: permission and model + effort (in the chat)', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.getByRole('button', { name: 'New workspace in repo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await pick(page, dialog.getByLabel('Project'), 'repo')
  await dialog.getByLabel('Workspace name').fill('pickers')
  await dialog.getByRole('button', { name: /Create workspace/ }).click()
  await expect(page.getByRole('heading', { name: 'pickers' })).toBeVisible({ timeout: 20_000 })

  // Permission: default Accept edits → Full access
  await expect(page.getByRole('button', { name: 'Permission' })).toContainText('Accept edits')
  await page.getByRole('button', { name: 'Permission' }).click()
  await expect(page.getByRole('menuitemradio', { name: /Ask for approval/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/permission-menu.png' })
  await page.getByRole('menuitemradio', { name: /Full access/ }).click()
  await expect(page.getByRole('button', { name: 'Permission' })).toContainText('Full access')

  // Model: sonnet → opus, effort High
  await page.getByRole('button', { name: 'Model' }).click()
  await page.getByPlaceholder('Search models…').fill('op')
  await expect(page.getByRole('menuitemradio')).toHaveCount(1)
  await page.getByPlaceholder('Search models…').fill('')
  await page.screenshot({ path: 'test-results/screens/model-menu.png' })
  await page.getByRole('menuitemradio', { name: /Opus 5.5/ }).click()
  await page.getByRole('button', { name: 'High', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Model' })).toContainText('Opus 5.5')
  await expect(page.getByRole('button', { name: 'Model' })).toContainText('High')

  // Saved on the chat: still there after a reload.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Permission' })).toContainText('Full access')
  await expect(page.getByRole('button', { name: 'Model' })).toContainText('Opus 5.5')
})

test('the chat follows new output to the bottom, and offers "Jump to latest" after scrolling up', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.getByRole('button', { name: 'New workspace in repo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await pick(page, dialog.getByLabel('Project'), 'repo')
  await dialog.getByLabel('Workspace name').fill('scrolling')
  await dialog.getByRole('button', { name: /Create workspace/ }).click()
  await expect(page.getByRole('heading', { name: 'scrolling' })).toBeVisible({ timeout: 20_000 })
  // Full access: the fake agent's tool call runs without an approval card.
  await page.getByRole('button', { name: 'Permission' }).click()
  await page.getByRole('menuitemradio', { name: /Full access/ }).click()

  const done = page.getByText('The command was allowed.')
  const tall = Array.from({ length: 14 }, (_, i) => `line ${i + 1}`).join('\n')
  for (let turn = 1; turn <= 4; turn++) {
    await page.getByPlaceholder(/Message Claude/).fill(`turn ${turn}\n${tall}`)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(done).toHaveCount(turn)
    // Without touching the scrollbar, the newest output is on screen.
    await expect(done.last()).toBeInViewport()
  }

  // Scroll up to read: it stops following and offers a way back.
  await done.last().hover()
  await page.mouse.wheel(0, -5000)
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toBeVisible()
  await expect(done.last()).not.toBeInViewport()
  await page.getByRole('button', { name: /Jump to latest/ }).click()
  await expect(done.last()).toBeInViewport()
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toBeHidden()
})

test('edit a workspace: turn a free chat into Planning and fill Iteration / Module later', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  // The only way to start a workspace is the project's "+"; the project row shows a folder icon.
  await expect(page.locator('aside').getByRole('button', { name: 'New workspace', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Collapse repo', exact: true })).toBeVisible()

  await page.getByTestId('workspace-row-smoke-feature').click()
  await expect(page.getByRole('heading', { name: 'smoke-feature' })).toBeVisible()
  await expect(page.getByText('Free chat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Edit workspace' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit workspace' })
  await pick(page, dialog.getByLabel('Type'), 'Planning')
  await dialog.getByLabel('Iteration').fill('i-17')
  await dialog.getByLabel('Module').fill('invoice')
  // PRD / Figma are still empty: saving is allowed, with a reminder.
  await expect(dialog.getByText(/Still empty: PRD, Figma/)).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/edit-workspace.png' })
  await dialog.getByRole('button', { name: /Save/ }).click()

  await expect(dialog).toBeHidden()
  await expect(page.locator('main header').getByText('Planning', { exact: true })).toBeVisible()
  await expect(page.getByText('i-17', { exact: true })).toBeVisible()
  await expect(page.getByText('frontend/modules/i-17/invoice', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/workspace-edited.png' })
})

test('Settings → Models: the list comes from the account; switched-on models show in the chat picker', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Models', exact: true }).click()

  // The account's models, each with a switch; the default list (sonnet, opus, haiku) is on.
  await expect(page.getByText('Fable 5.2')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Show Opus 5.5' })).toBeChecked()
  await expect(page.getByRole('switch', { name: 'Show Fable 5.2' })).not.toBeChecked()
  // No more typing model ids.
  await expect(page.getByPlaceholder(/Model id/)).toHaveCount(0)

  await page.getByRole('switch', { name: 'Show Fable 5.2' }).click()
  await page.getByRole('switch', { name: 'Show Haiku 5.5' }).click()
  await page.getByRole('button', { name: 'Make Fable 5.2 the default' }).click()
  await page.screenshot({ path: 'test-results/screens/settings-models.png' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Models saved')).toBeVisible()

  // The chat picker offers exactly the switched-on models, with the account's names.
  await page.getByTestId('workspace-row-pickers').click()
  await page.getByRole('button', { name: 'Model' }).click()
  const items = page.getByRole('menuitemradio')
  await expect(items.filter({ hasText: 'Fable 5.2' })).toBeVisible()
  await expect(items.filter({ hasText: 'For your toughest challenges' })).toBeVisible()
  await expect(items.filter({ hasText: 'Haiku 5.5' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/screens/chat-model-picker.png' })
})

test('the sidebar can be resized and remembers its width', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  const aside = page.locator('aside').first()
  await expect(aside).toHaveCSS('width', '300px')
  const handle = page.getByRole('separator', { name: 'Resize sidebar' })
  const box = await handle.boundingBox()
  if (!box) throw new Error('no resize handle')
  await page.mouse.move(box.x + box.width / 2, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 100, box.y + 200, { steps: 5 })
  await page.mouse.up()
  const widened = Number.parseInt(await aside.evaluate((el) => getComputedStyle(el).width), 10)
  expect(widened).toBeGreaterThan(380)
  await page.reload()
  await expect(aside).toHaveCSS('width', `${widened}px`)
})
