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
  // Start: the link from `nakoda start` carries the token; it becomes a cookie and leaves the URL.
  await page.goto(`/?token=${TOKEN}`)
  await expect(page.locator(`aside [title="Nakoda: You're the captain, the agents are your crew"]`)).toContainText('Nakoda')
  await expect(page).not.toHaveURL(/token=/)
  await page.screenshot({ path: shot('1-home') })

  // Accounts
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
  await expect(page.getByText('smoke@example.com')).toBeVisible()
  await page.screenshot({ path: shot('2-accounts') })

  // Settings replaces the main sidebar (like Docs): go back before opening Docs.
  await page.getByRole('button', { name: 'Back to Nakoda' }).click()

  // Docs: rendered markdown, table, mermaid, wiki-link
  await page.getByRole('link', { name: 'Docs', exact: true }).click()
  await page.getByRole('button', { name: 'README' }).click()
  await expect(page.getByRole('heading', { name: 'Smoke vault' })).toBeVisible()
  await expect(page.locator('.markdown table')).toBeVisible()
  await expect(page.locator('.markdown svg').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: shot('3-docs') })
  await page.getByRole('link', { name: 'Second note' }).click()
  await expect(page.getByRole('heading', { name: 'Second note' })).toBeVisible()

  // Back to the main sidebar
  await page.getByRole('button', { name: 'Back to Nakoda' }).click()

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
  // Let the first (home) listing land before typing, so it can't race the typed path.
  await expect(page.getByRole('button', { name: /Use this folder:/ })).toBeVisible()
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
  await expect(page.getByText("This browser isn't connected to Nakoda")).toBeVisible()
  await expect(page.getByText('nakoda open --print', { exact: false })).toBeVisible()
  // A wrong token does not connect either.
  await page.goto('/?token=wrong')
  await expect(page.getByText("This browser isn't connected to Nakoda")).toBeVisible()
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

test('Settings lives in the sidebar: sections, Connectors, and Back to Nakoda', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()

  // The sections are in the sidebar (not tabs in the page); General is open first.
  const sections = page.getByRole('navigation', { name: 'Settings sections' })
  for (const name of ['General', 'Workflows', 'Accounts', 'Models', 'Docs', 'Connectors']) {
    await expect(sections.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(sections.getByRole('button', { name: 'General', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 1, name: 'General', exact: true })).toBeVisible()

  // Connectors: empty for now.
  await sections.getByRole('button', { name: 'Connectors', exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/connectors$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Connectors', exact: true })).toBeVisible()
  await expect(page.getByText('No connectors yet')).toBeVisible()
  // Platforms: only Helix can be chosen; picking it adds a card whose Configure opens the setup modal.
  await page.getByRole('combobox', { name: 'Add connector' }).click()
  for (const name of ['Jira', 'ClickUp', 'Lark']) await expect(page.getByRole('option', { name: new RegExp(name) })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('option', { name: 'Helix' }).click()
  const card = page.getByRole('region', { name: 'Helix connector' })
  await expect(card.getByRole('status')).toHaveText('Not configured')
  await card.getByRole('button', { name: 'Configure' }).click()
  await expect(page.getByRole('dialog', { name: 'Configure Helix' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await card.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No connectors yet')).toBeVisible()
  // The sidebar follows the page: Connectors is the current section, General is not.
  await expect(sections.getByRole('button', { name: 'Connectors', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(sections.getByRole('button', { name: 'General', exact: true })).not.toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: 'test-results/screens/settings-connectors.png', animations: 'disabled' })

  // Back returns to the main sidebar.
  await page.getByRole('button', { name: 'Back to Nakoda' }).click()
  await expect(page.locator('aside').getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.locator('aside').getByRole('link', { name: 'Docs', exact: true })).toBeVisible()
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

  // Settings replaces the main sidebar: go back to reach the workspace list.
  await page.getByRole('button', { name: 'Back to Nakoda' }).click()

  // The chat picker offers exactly the switched-on models, with the account's names.
  await page.getByTestId('workspace-row-pickers').click()
  await page.getByRole('button', { name: 'Model' }).click()
  const items = page.getByRole('menuitemradio')
  await expect(items.filter({ hasText: 'Fable 5.2' })).toBeVisible()
  await expect(items.filter({ hasText: 'For your toughest challenges' })).toBeVisible()
  await expect(items.filter({ hasText: 'Haiku 5.5' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/screens/chat-model-picker.png' })
  await page.keyboard.press('Escape')

  // Create workspace: the Model list is the same switched-on models, named by the account; ★ preselected.
  await page.getByRole('button', { name: 'New workspace in repo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await expect(dialog.getByLabel('Model')).toContainText('Fable 5.2')
  await dialog.getByLabel('Model').click()
  await expect(page.getByRole('option', { name: 'Sonnet 5.5', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Haiku 5.5', exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/screens/create-workspace-models.png', animations: 'disabled' })
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

test('Connect Helix in Settings, then read the External tab (read-only)', async ({ page }) => {
  const token = `sidpjm_${'d'.repeat(64)}`
  await page.goto(`/?token=${TOKEN}`)

  // Tasks → External with nothing connected points to Connectors.
  await page.locator('aside').getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'External' }).click()
  await expect(page.getByText('No task source is connected yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Connect Helix' }).click()
  await expect(page).toHaveURL(/\/settings\/connectors$/)

  // Add a connection with a pasted token; it is tested right away.
  await page.getByRole('combobox', { name: 'Add connector' }).click()
  await page.getByRole('option', { name: 'Helix' }).click()
  await page.getByRole('button', { name: 'Configure' }).click()
  await page.getByLabel('Helix address').fill('http://helix.example.test')
  await page.getByLabel('Read-only token').fill(token)
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByText('Helix must be reached over https')).toBeVisible()
  await page.getByLabel('Helix address').fill('https://helix.example.test')
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByTestId('connection-test')).toContainText('Connected as Ada Lovelace')
  await expect(page.getByTestId('connection-test')).toContainText('Scope: read_only')
  await expect(page.getByRole('region', { name: 'Helix connector' }).getByRole('status')).toHaveText('Connected')
  // The token is only ever shown as a hint.
  await expect(page.getByText('sidpjm_…dddd')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(token)
  await page.screenshot({ path: shot('connectors-helix'), animations: 'disabled' })

  // External tab: my tickets, defect vs task, link to the source.
  await page.locator('aside').getByRole('button', { name: 'Back to Nakoda' }).click()
  await page.locator('aside').getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'External' }).click()
  const list = page.getByTestId('external-list')
  await expect(list.getByText('T2-3672')).toBeVisible()
  await expect(list.getByText('T2-3252')).toBeVisible()
  await expect(list.getByText('Old and archived')).toHaveCount(0)
  // The status filter offers Helix's real status names.
  await pick(page, page.getByLabel('Status', { exact: true }), 'To do')
  await expect(list.getByText('T2-3672')).toBeVisible()
  await pick(page, page.getByLabel('Status', { exact: true }), 'All statuses')
  await expect(list.locator('li', { hasText: 'T2-3672' }).getByText('Defect')).toBeVisible()
  await expect(list.locator('li', { hasText: 'T2-3252' }).getByText('Task', { exact: true })).toBeVisible()
  await expect(list.locator('li', { hasText: 'T2-3672' }).getByRole('link', { name: /Open in source/ })).toHaveAttribute('href', 'https://helix.example.test/tickets/T2-3672')
  // Subtasks: Helix search never lists them, so a story opens to show its children.
  const storyItem = page.getByTestId('external-item').filter({ hasText: 'Invoice Management - Phase 1' })
  await storyItem.getByRole('button', { name: 'Show subtasks of T2-3252' }).click()
  const subtasks = storyItem.getByTestId('subtasks')
  await expect(subtasks.getByText('T2-3274')).toBeVisible()
  await expect(subtasks.getByText('T2-3391')).toBeVisible()
  await expect(subtasks.getByText('Old, archived')).toHaveCount(0)
  await expect(subtasks.getByRole('button', { name: 'Transfer' })).toHaveCount(3)
  await page.screenshot({ path: shot('external-tab'), animations: 'disabled' })
  // Subtasks have their own workflow (open / in progress / done), so their own filter: a Done
  // story can still have open subtasks.
  await pick(page, page.getByLabel('Subtask status'), 'Subtasks: Open')
  const filtered = page.getByTestId('external-item').filter({ hasText: 'Invoice Management - Phase 1' }).getByTestId('subtasks')
  await expect(filtered.getByText('T2-3275')).toBeVisible()
  await expect(filtered.getByText('T2-3274')).toHaveCount(0)
  await expect(filtered.getByText('T2-3391')).toHaveCount(0)
  await pick(page, page.getByLabel('Subtask status'), 'Subtasks: In progress')
  await expect(filtered.getByText('T2-3391')).toBeVisible()
  await expect(filtered.getByText('T2-3275')).toHaveCount(0)
  // The story itself (Done) stays in the list.
  await expect(page.getByTestId('external-item').filter({ hasText: 'Invoice Management - Phase 1' })).toBeVisible()
  await pick(page, page.getByLabel('Subtask status'), 'All subtask statuses')
  // My subtasks are found through every story in the iteration, even one assigned to someone else.
  await expect(page.getByText(/Pick a board and an iteration to also see the subtasks assigned to you/)).toBeVisible()
  await pick(page, page.getByLabel('Board'), 'TRIBE 2')
  await pick(page, page.getByLabel('Iteration'), 'Iteration 15')
  const mySubtasks = page.getByTestId('my-subtasks')
  await expect(mySubtasks.getByText('Subtasks assigned to you · 1')).toBeVisible()
  await expect(mySubtasks.getByTestId('my-subtask').filter({ hasText: 'T2-3275' })).toContainText('in T2-3252 · Invoice Management - Phase 1')
  await expect(mySubtasks.getByText('T2-3274')).toHaveCount(0)
  await expect(mySubtasks.getByRole('button', { name: 'Transfer' })).toHaveCount(1)

  // Clean up so the empty-state test above stays true on a re-run.
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Connectors', exact: true }).click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No connectors yet')).toBeVisible()
})

test('Task board: create a ticket, see what is missing, assign it, and one active ticket per workspace', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.locator('aside').getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Our board', selected: true })).toBeVisible()
  for (const name of ['Backlog', 'In progress', 'Review', 'Done']) await expect(page.getByRole('region', { name })).toBeVisible()

  const card = (title: string) => page.getByTestId('task-card').filter({ hasText: title })
  const dialog = page.getByRole('dialog')

  // A new ticket starts with the Planning workflow, so its required fields are missing.
  await page.getByRole('button', { name: 'New ticket' }).click()
  await dialog.getByLabel('Title').fill('Fix invoice total')
  await dialog.getByLabel('Description').fill('The total ignores the discount.')
  await pick(page, dialog.getByLabel('Project'), 'repo')
  await expect(dialog.getByText(/Missing: PRD, Figma, Iteration, Module/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Create ticket' }).click()
  await expect(page.getByRole('region', { name: 'Backlog' }).getByText('Missing: PRD, Figma, Iteration, Module')).toBeVisible()

  // Free chat needs no extra fields: the card turns Ready.
  await card('Fix invoice total').click()
  await pick(page, dialog.getByLabel('Workflow'), 'Free chat')
  await expect(dialog.getByText('Ready to assign.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save ticket' }).click()
  await expect(card('Fix invoice total').getByText('Ready', { exact: true })).toBeVisible()
  await page.screenshot({ path: shot('task-board-ready'), animations: 'disabled' })

  // Assign by creating a new workspace from the ticket: pre-filled, project locked.
  await card('Fix invoice total').click()
  await dialog.getByRole('button', { name: 'Assign to a workspace…' }).click()
  await dialog.getByRole('button', { name: 'Create a new workspace' }).click()
  const create = page.getByRole('dialog', { name: 'Create workspace' })
  await expect(create.getByLabel('Workspace name')).toHaveValue('fix-invoice-total')
  await expect(create.getByLabel('Project')).toBeDisabled()
  await create.getByRole('button', { name: /Create workspace/ }).click()
  await expect(page).toHaveURL(/\/workspaces\//)

  // Back on the board the ticket is In progress, with its workspace.
  await page.locator('aside').getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('region', { name: 'In progress' }).getByText('Fix invoice total')).toBeVisible()
  await expect(card('Fix invoice total').getByRole('button', { name: /fix-invoice-total/ })).toBeVisible()

  // A second ticket cannot take that workspace while the first is still in progress.
  await page.getByRole('button', { name: 'New ticket' }).click()
  await dialog.getByLabel('Title').fill('Fix invoice date')
  await dialog.getByLabel('Description').fill('Wrong date format.')
  await pick(page, dialog.getByLabel('Project'), 'repo')
  await pick(page, dialog.getByLabel('Workflow'), 'Free chat')
  await dialog.getByRole('button', { name: 'Create ticket' }).click()
  await card('Fix invoice date').click()
  await dialog.getByRole('button', { name: 'Assign to a workspace…' }).click()
  const row = dialog.getByTestId('assign-candidate').filter({ hasText: 'fix-invoice-total' })
  await expect(row.getByText(/Busy with "Fix invoice total"/)).toBeVisible()
  await expect(row.getByRole('button', { name: 'Assign' })).toBeDisabled()
  await page.screenshot({ path: shot('task-assign-busy'), animations: 'disabled' })
  await page.keyboard.press('Escape')

  // Drag the first ticket to Review: the workspace is free again.
  await card('Fix invoice total').dragTo(page.getByRole('region', { name: 'Review' }))
  await expect(page.getByRole('region', { name: 'Review' }).getByText('Fix invoice total')).toBeVisible()
  await card('Fix invoice date').click()
  await dialog.getByRole('button', { name: 'Assign to a workspace…' }).click()
  const free = dialog.getByTestId('assign-candidate').filter({ hasText: 'fix-invoice-total' })
  await expect(free.getByRole('button', { name: 'Assign' })).toBeEnabled()
  await free.getByRole('button', { name: 'Assign' }).click()
  await expect(page.getByRole('region', { name: 'In progress' }).getByText('Fix invoice date')).toBeVisible()
  await page.screenshot({ path: shot('task-board'), animations: 'disabled' })
})

test('Transfer a Helix defect and a story to the board; the defect gets the Defect workflow', async ({ page }) => {
  const token = `sidpjm_${'e'.repeat(64)}`
  await page.goto(`/?token=${TOKEN}`)
  // Connect (this test is self-contained and cleans up).
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Connectors', exact: true }).click()
  await page.getByRole('combobox', { name: 'Add connector' }).click()
  await page.getByRole('option', { name: 'Helix' }).click()
  await page.getByRole('button', { name: 'Configure' }).click()
  await page.getByLabel('Helix address').fill('https://helix.example.test')
  await page.getByLabel('Read-only token').fill(token)
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByTestId('connection-test')).toContainText('Connected as Ada Lovelace')

  // The mappings are editable on the connection.
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByLabel('Severity mapping')).toHaveValue(/high=major/)
  await expect(page.getByLabel('Environment mapping')).toHaveValue('defect_staging=staging')
  await page.getByRole('button', { name: 'Cancel' }).click()

  // External: transfer both tickets.
  await page.locator('aside').getByRole('button', { name: 'Back to Nakoda' }).click()
  await page.locator('aside').getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'External' }).click()
  const row = (key: string) => page.getByTestId('external-list').locator('li', { hasText: key })
  await row('T2-3672').getByRole('button', { name: 'Transfer' }).click()
  await expect(row('T2-3672').getByText('On board')).toBeVisible()
  await row('T2-3252').getByRole('button', { name: 'Transfer' }).click()
  await expect(row('T2-3252').getByText('On board')).toBeVisible()
  // Once only: there is no Transfer button any more.
  await expect(row('T2-3672').getByRole('button', { name: 'Transfer' })).toHaveCount(0)

  // Board: both are in Backlog with their source; the defect carries the Defect workflow's values.
  await page.getByRole('tab', { name: 'Our board' }).click()
  const backlog = page.getByRole('region', { name: 'Backlog' })
  await expect(backlog.getByText('[FE] Link redirect after login')).toBeVisible()
  await expect(backlog.getByText('Invoice Management - Phase 1')).toBeVisible()
  const defect = page.getByTestId('task-card').filter({ hasText: '[FE] Link redirect after login' })
  await expect(defect.getByText('Defect', { exact: true })).toBeVisible()
  await expect(defect.getByText('T2-3672')).toBeVisible()
  await defect.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Workflow')).toContainText('Defect')
  await expect(dialog.getByLabel('Environment')).toContainText('staging')
  await expect(dialog.getByLabel('Severity')).toContainText('minor')
  await expect(dialog.getByLabel('Iteration')).toHaveValue('i-15')
  await expect(dialog.getByLabel('Steps to reproduce')).toHaveValue('1. Open the emailed link while logged out')
  await expect(dialog.getByLabel('Defect', { exact: true })).toHaveValue('fe-link-redirect-after-login')
  await expect(dialog.getByRole('link', { name: /Open in source/ })).toHaveAttribute('href', 'https://helix.example.test/tickets/T2-3672')
  // What is left for a person: app, page URL and handling expectation.
  await expect(dialog.getByText(/Missing: .*App.*URL page.*Handling expectation/)).toBeVisible()
  await page.screenshot({ path: shot('task-defect'), animations: 'disabled' })
  await page.keyboard.press('Escape')

  // A subtask (only reachable through its story) transfers too, with the story's PRD, Figma and text.
  await page.getByRole('tab', { name: 'External' }).click()
  const storyRow = page.getByTestId('external-item').filter({ hasText: 'Invoice Management - Phase 1' })
  await storyRow.getByRole('button', { name: 'Show subtasks of T2-3252' }).click()
  const subRow = storyRow.getByTestId('subtasks').locator('div', { hasText: 'T2-3274' }).last()
  await subRow.getByRole('button', { name: 'Transfer' }).click()
  await expect(subRow.getByText('On board')).toBeVisible()
  await page.getByRole('tab', { name: 'Our board' }).click()
  const subCard = page.getByTestId('task-card').filter({ hasText: '[FE] Invoice list' })
  await expect(subCard.getByText(/Missing: .*Module/)).toBeVisible()
  await expect(subCard.getByText(/PRD|Figma|Iteration|Description/)).toHaveCount(0)
  await subCard.click()
  await expect(dialog.getByLabel('Description')).toHaveValue(/Parent story: \[T2-3252\]/)
  await expect(dialog.getByLabel('Iteration')).toHaveValue('i-13')
  await page.keyboard.press('Escape')

  // The story is a Planning ticket: PRD, Figma and iteration are filled; module is missing (and the
  // project too when there is more than one to choose from).
  const story = page.getByTestId('task-card').filter({ hasText: 'Invoice Management - Phase 1' })
  await expect(story.getByText(/Missing: .*Module/)).toBeVisible()
  await expect(story.getByText(/PRD|Figma|Iteration/)).toHaveCount(0)
  // Its subtasks came along, linked to Helix (the archived one did not).
  await story.click()
  await expect(dialog.getByLabel('Description')).toHaveValue(/## Subtasks \(3\)[\s\S]*T2-3274[\s\S]*T2-3275[\s\S]*T2-3391/)
  await expect(dialog.getByLabel('Description')).not.toHaveValue(/T2-3000/)
  await page.keyboard.press('Escape')

  // Clean up.
  await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Connectors', exact: true }).click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No connectors yet')).toBeVisible()
})

test('Tasks and Docs open in a new tab, already signed in', async ({ page, context }) => {
  await page.goto(`/?token=${TOKEN}`)
  const aside = page.locator('aside')
  for (const [label, path, check] of [
    ['Tasks', '/tasks/board', 'Tasks'],
    ['Docs', '/docs', 'README'],
  ] as const) {
    await expect(aside.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', path)
    await aside.getByRole('link', { name: label, exact: true }).hover()
    const [tab] = await Promise.all([context.waitForEvent('page'), aside.getByRole('link', { name: `Open ${label} in a new tab` }).click()])
    await tab.waitForLoadState()
    await expect(tab).toHaveURL(new RegExp(`${path}$`))
    // The session cookie carries over: the new tab is not asked to connect again.
    await expect(tab.getByText(check).first()).toBeVisible()
    await expect(tab.getByText("This browser isn't connected to Nakoda")).toHaveCount(0)
    await tab.close()
  }
  // A plain click still stays in this tab.
  await aside.getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks\/board$/)
  expect(context.pages()).toHaveLength(1)
})

test('Settings → Docs hides a folder from the Docs sidebar, and shows it again', async ({ page }) => {
  await page.goto(`/?token=${TOKEN}`)
  await page.goto(`/settings/docs?token=${TOKEN}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Docs', exact: true })).toBeVisible()
  const notes = page.getByRole('switch', { name: 'Show notes' })
  await expect(notes).toBeChecked()
  await notes.click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Docs saved')).toBeVisible()

  await page.goto(`/docs?token=${TOKEN}`)
  const sidebar = page.locator('aside')
  await expect(sidebar.getByText('README', { exact: true })).toBeVisible()
  await expect(sidebar.getByText('notes', { exact: true })).toHaveCount(0)

  // Back on: the folder returns.
  await page.goto(`/settings/docs?token=${TOKEN}`)
  await page.getByRole('switch', { name: 'Show notes' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Docs saved')).toBeVisible()
  await page.goto(`/docs?token=${TOKEN}`)
  await expect(page.locator('aside').getByText('notes', { exact: true })).toBeVisible()
})
