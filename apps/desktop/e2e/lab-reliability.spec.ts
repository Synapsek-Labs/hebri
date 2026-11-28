import * as fs from 'node:fs'
import * as path from 'node:path'

import { gate, startScriptedProvider } from './core/provider'
import { recordWebSockets, routePrimaryWebSocket, startTcpProxy } from './core/harness'
import {
  buildAppEnv,
  createSandbox,
  launchDesktop,
  waitForAppReady,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { expect, test } from './test'

test('narrow window, concurrent chats, cancellation and native restart retain usable transcripts', async () => {
  test.setTimeout(240_000)
  const provider = await startScriptedProvider()
  const sandbox = createSandbox('lab-reliability')
  writeMockProviderConfig(sandbox.hermesHome, provider.url, undefined, 'approvals:\n  mode: manual\n')
  writeEnvFile(sandbox.hermesHome)
  const env = buildAppEnv(sandbox, {
    USERPROFILE: sandbox.root,
    APPDATA: path.join(sandbox.root, 'appdata'),
    LOCALAPPDATA: path.join(sandbox.root, 'localappdata'),
    HEBRI_HOME: sandbox.hermesHome,
    HERMES_SHARED_AUTH_DIR: path.join(sandbox.hermesHome, 'shared'),
    HERMES_DESKTOP_DEV_SERVER: '',
    HERMES_DESKTOP_PYTHON: process.env.HERMES_DESKTOP_PYTHON ?? ''
  })
  let { app, page } = await launchDesktop(env)
  const hold = gate()
  let proxy: Awaited<ReturnType<typeof startTcpProxy>> | undefined
  try {
    await waitForAppReady({ app, page, sandbox, cleanup: async () => {} }, 120_000)
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!
      window.setMinimumSize(640, 600)
      window.setSize(720, 760)
    })
    const composer = () => page.locator('[contenteditable="true"]').filter({ visible: true }).first()
    await page.getByRole('button', { name: 'Simple', exact: true }).press('Enter')
    await expect(composer()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow).toBeLessThanOrEqual(2)
    await composer().focus()
    await expect(composer()).toBeFocused()
    provider.script('U1-concurrent', [
      { text: ['FIRST_CHAT_START', ' FIRST_CHAT_FINISHED'], holdAfterFirstChunk: hold }
    ])
    await composer().fill('U1-concurrent keep this chat running')
    await composer().press('Enter')
    await expect(page.getByText('FIRST_CHAT_START', { exact: true })).toBeVisible({ timeout: 60_000 })
    const firstRoute = await page.evaluate(() => location.hash)
    expect(firstRoute).not.toBe('#/')
    await page.evaluate(() => {
      location.hash = '#/'
    })
    provider.script('U2-concurrent', [{ text: ['SECOND_CHAT_FINISHED'] }])
    await composer().fill('U2-concurrent answer in a separate chat')
    await composer().press('Enter')
    await expect(page.getByText('SECOND_CHAT_FINISHED', { exact: true })).toBeVisible({ timeout: 60_000 })
    const secondRoute = await page.evaluate(() => location.hash)
    expect(secondRoute).not.toBe(firstRoute)
    hold.open()
    await expect.poll(() => provider.completions.find(c => c.marker === 'U1-concurrent')?.finished).toBe(true)
    await page.evaluate(route => {
      location.hash = route
    }, firstRoute)
    await expect(page.getByText('FIRST_CHAT_START FIRST_CHAT_FINISHED', { exact: true })).toBeVisible()
    await expect(page.getByText('SECOND_CHAT_FINISHED', { exact: true })).toHaveCount(0)
    const clippedButtons = await page
      .locator('form button:visible')
      .evaluateAll(buttons =>
        buttons
          .filter(button => button.scrollWidth > button.clientWidth + 2)
          .map(button => button.getAttribute('aria-label'))
      )
    expect(clippedButtons).toEqual([])
    await page.screenshot({ path: test.info().outputPath('narrow-completed.png') })

    // Stop while a real script is between two writes. The first committed write
    // must remain honest; cancellation must prevent the later write.
    const before = path.join(sandbox.root, 'before-stop.txt')
    const after = path.join(sandbox.root, 'after-stop.txt')
    const code = `from pathlib import Path\nimport time\nPath(${JSON.stringify(before)}).write_text('committed', encoding='utf-8')\ntime.sleep(15)\nPath(${JSON.stringify(after)}).write_text('must not run', encoding='utf-8')`
    provider.script('U3-fileinterrupt', [
      { toolCalls: [{ name: 'execute_code', args: { code } }] },
      { text: ['UNEXPECTED_FINISHED'] }
    ])
    await composer().fill('U3-fileinterrupt execute the isolated interruption fixture')
    await composer().press('Enter')
    await page.getByRole('button', { name: /^Approve once/ }).click({ timeout: 60_000 })
    await expect.poll(() => fs.existsSync(before), { timeout: 30_000 }).toBe(true)
    await page.locator('form').getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(page.locator('form').getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0, {
      timeout: 30_000
    })
    await expect(
      page
        .getByText(/Stopped|cancelled|canceled|Interrupted/i)
        .filter({ visible: true })
        .first()
    ).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('interrupted-file-task.png') })
    await expect(
      page.getByText(
        'Stopped before the result was confirmed. Some actions may already have happened; check before retrying.'
      )
    ).toBeVisible()
    // Wait beyond the script's second write deadline; this checks absence of an
    // observable side effect, not just an optimistic "stopped" label.
    await new Promise(resolve => setTimeout(resolve, 16_000))
    expect(fs.readFileSync(before, 'utf8')).toBe('committed')
    expect(fs.existsSync(after)).toBe(false)
    await expect(page.getByText('UNEXPECTED_FINISHED', { exact: true })).toHaveCount(0)

    await app.close()
    ;({ app, page } = await launchDesktop(env))
    await waitForAppReady({ app, page, sandbox, cleanup: async () => {} }, 120_000)
    await page.evaluate(route => {
      location.hash = route
    }, secondRoute)
    await expect(page.getByText('SECOND_CHAT_FINISHED', { exact: true })).toBeVisible({ timeout: 30_000 })
    provider.script('U4-restarted', [{ text: ['RESTART_RECOVERED'] }])
    await composer().fill('U4-restarted continue after a native app restart')
    await composer().press('Enter')
    await expect(page.getByText('RESTART_RECOVERED', { exact: true })).toBeVisible({ timeout: 60_000 })
    expect(provider.completions.filter(c => c.marker === 'U2-concurrent')).toHaveLength(1)

    const sockets = recordWebSockets(page)
    await page.reload()
    await expect.poll(() => sockets.sockets.length).toBeGreaterThan(0)
    const port = Number(new URL(sockets.sockets[0]!.url).port)
    proxy = await startTcpProxy(port)
    await routePrimaryWebSocket(app, port, proxy.port)
    await page.reload()
    await expect.poll(() => proxy!.connections()).toBeGreaterThan(0)
    await expect(composer()).toBeVisible()
    const offlineHold = gate()
    provider.script('U5-network', [
      { text: ['BEFORE_NETWORK_DROP', ' AFTER_NETWORK_RECOVERY'], holdAfterFirstChunk: offlineHold }
    ])
    await composer().fill('U5-network preserve the response across a lost connection')
    await composer().press('Enter')
    await expect(page.getByText('BEFORE_NETWORK_DROP', { exact: true })).toBeVisible({ timeout: 60_000 })
    proxy.setOnline(false)
    await expect.poll(() => proxy!.connections()).toBe(0)
    offlineHold.open()
    await expect.poll(() => provider.completions.find(c => c.marker === 'U5-network')?.finished).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 5_000))
    await page.screenshot({ path: test.info().outputPath('connection-lost.png') })
    proxy.setOnline(true)
    // Exercise the real Electron -> preload -> renderer wake notification.
    // This is a resume-signal rehearsal, not a claim of physical host sleep.
    await app.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('resume')
    })
    await expect(page.getByText('BEFORE_NETWORK_DROP AFTER_NETWORK_RECOVERY', { exact: true })).toBeVisible({
      timeout: 60_000
    })
    await expect(page.getByText('BEFORE_NETWORK_DROP AFTER_NETWORK_RECOVERY', { exact: true })).toHaveCount(1)
    expect(provider.completions.filter(c => c.marker === 'U5-network')).toHaveLength(1)
    await page.reload()
    await expect(page.getByText('BEFORE_NETWORK_DROP AFTER_NETWORK_RECOVERY', { exact: true })).toBeVisible({
      timeout: 30_000
    })
    for (const width of [640, 900, 1280]) {
      await app.evaluate(({ BrowserWindow }, width) => {
        BrowserWindow.getAllWindows()[0]!.setSize(width, 760)
      }, width)
      await expect(composer()).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(2)
      await expect
        .poll(() =>
          page
            .locator('form button:visible')
            .evaluateAll(buttons => buttons.filter(button => button.scrollWidth > button.clientWidth + 2).length)
        )
        .toBe(0)
      await composer().focus()
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
      await page.screenshot({ path: test.info().outputPath(`recovered-width-${width}.png`) })
    }
  } finally {
    hold.open()
    await app.close().catch(() => undefined)
    await proxy?.close()
    await provider.close()
    sandbox.cleanup()
  }
})
