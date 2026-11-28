import * as fs from 'node:fs'
import * as path from 'node:path'
import { _electron } from '@playwright/test'

import { startScriptedProvider } from './core/provider'
import {
  buildAppEnv,
  createSandbox,
  PACKAGED_BINARY_PATH,
  waitForAppReady,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { expect, test } from './test'

test('packaged renderer and bundled agent complete an approved isolated file task', async () => {
  test.setTimeout(180_000)
  expect(fs.existsSync(PACKAGED_BINARY_PATH), 'Build the package before qualification').toBe(true)
  const resources =
    process.platform === 'darwin'
      ? path.resolve(path.dirname(PACKAGED_BINARY_PATH), '../Resources')
      : path.join(path.dirname(PACKAGED_BINARY_PATH), 'resources')
  const bundled = path.join(resources, 'hebri-source')
  expect(fs.existsSync(path.join(bundled, 'run_agent.py'))).toBe(true)
  const sandbox = createSandbox('packaged-real-runtime')
  const provider = await startScriptedProvider()
  writeMockProviderConfig(sandbox.hermesHome, provider.url, undefined, 'approvals:\n  mode: manual\n')
  writeEnvFile(sandbox.hermesHome)
  const output = path.join(sandbox.root, 'packaged-proof.txt')
  provider.script('U1-packaged', [
    {
      toolCalls: [
        {
          name: 'execute_code',
          args: {
            code: `from pathlib import Path\nPath(${JSON.stringify(output)}).write_text('PACKAGED_RUNTIME_CONFIRMED', encoding='utf-8')\nprint('file saved')`
          }
        }
      ]
    },
    { text: ['PACKAGED_TASK_COMPLETED'] }
  ])
  const env = buildAppEnv(sandbox, {
    HERMES_DESKTOP_HERMES_ROOT: bundled,
    HERMES_DESKTOP_PYTHON: process.env.HERMES_DESKTOP_PYTHON ?? '',
    HERMES_DESKTOP_DEV_SERVER: ''
  })
  const app = await _electron.launch({
    executablePath: PACKAGED_BINARY_PATH,
    args: ['--disable-gpu', '--no-sandbox'],
    env
  })
  try {
    const page = await app.firstWindow()
    const composer = page.locator('[contenteditable="true"]').filter({ visible: true }).first()
    await waitForAppReady({ app, page, sandbox, cleanup: async () => {} }, 120_000)
    expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true)
    expect(page.url()).toContain('app.asar')
    await page.getByRole('button', { name: 'Simple', exact: true }).click()
    await composer.fill('U1-packaged create the isolated qualification file')
    await expect(page.locator('form').getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
    await composer.press('Enter')
    await page.getByRole('button', { name: /^Approve once/ }).click({ timeout: 60_000 })
    await expect(page.getByText('PACKAGED_TASK_COMPLETED', { exact: true })).toBeVisible({ timeout: 60_000 })
    expect(fs.readFileSync(output, 'utf8')).toBe('PACKAGED_RUNTIME_CONFIRMED')
    expect(provider.completions.filter(item => item.marker === 'U1-packaged')).toHaveLength(2)
    await page.screenshot({ path: test.info().outputPath('packaged-real-task.png') })
  } finally {
    await app.close().catch(() => undefined)
    await provider.close()
    sandbox.cleanup()
  }
})
