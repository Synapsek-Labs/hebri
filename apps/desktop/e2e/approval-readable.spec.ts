import * as path from 'node:path'

import { startScriptedProvider } from './core/provider'
import {
  buildAppEnv,
  createSandbox,
  launchDesktop,
  waitForAppReady,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { expect, test } from './test'

// Real Electron, gateway, approval guard and Python execution. Only inference
// is scripted. No provider credentials, customer profiles or external writes.
test('readable script approvals preserve the real approve and decline round trips', async () => {
  test.setTimeout(180_000)
  const provider = await startScriptedProvider()
  const sandbox = createSandbox('readable-approval')
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

  const { app, page } = await launchDesktop(env)

  try {
    await waitForAppReady({ app, page, sandbox, cleanup: async () => {} }, 120_000)

    for (const [index, choice] of ['Approve once', 'Decline'].entries()) {
      const marker = `U${index + 1}-readableapproval`
      const output = `APPROVAL_RESULT_${index}`
      const code = `print('${output}')`
      provider.script(marker, [
        { toolCalls: [{ name: 'execute_code', args: { code } }] },
        { text: [`FINISHED_${index}`] }
      ])
      const composer = page.locator('[contenteditable="true"]').filter({ visible: true }).first()
      await composer.fill(`${marker} run the harmless print test`)
      await composer.press('Enter')

      const card = page.locator('[data-slot="tool-approval-card"]').filter({ visible: true })
      await expect(card).toHaveCount(1, { timeout: 60_000 })
      await expect(card.getByText('Run an automation script?')).toBeVisible()
      await expect(card.getByText(/This script can run programs and change files/)).toBeVisible()
      await expect(card.locator('pre')).toHaveCount(0)
      expect(provider.completions.some(c => c.marker === marker && c.step === 1)).toBe(false)
      await card.getByRole('button', { name: 'Technical details' }).click()
      await expect(card.locator('pre')).toContainText(code)
      expect(provider.completions.some(c => c.marker === marker && c.step === 1)).toBe(false)
      await page.screenshot({ path: test.info().outputPath(`approval-${index}.png`) })
      await card.getByRole('button', { name: choice }).click()
      await expect(page.getByText(`FINISHED_${index}`, { exact: true })).toBeVisible({ timeout: 60_000 })
      await expect(card).toHaveCount(0)
      const next = provider.completions.find(c => c.marker === marker && c.step === 1)
      const result = next?.body.messages.filter((m: { role: string }) => m.role === 'tool').at(-1)?.content
      expect(typeof result).toBe('string')

      if (index === 0) {
        expect(result).toContain(output)
      } else {
        expect(result).toMatch(/denied|reject|not approved/i)
        expect(result).not.toContain(output)
      }
    }
  } finally {
    await app.close().catch(() => undefined)
    await provider.close()
    sandbox.cleanup()
  }
})
