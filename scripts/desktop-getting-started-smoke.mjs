// Build apps/desktop first. Pass an existing Python with Hebri dependencies:
// node scripts/desktop-getting-started-smoke.mjs /path/to/python [--capture]
// No credentials are inherited, no provider is connected, no agent task runs.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { _electron: electron } = require('playwright')
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = path.resolve(process.argv[2] || '.venv/Scripts/python.exe')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hebri-guide-'))
const capture = process.argv.includes('--capture')
const env = {}
for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS']) {
  if (process.env[key]) env[key] = process.env[key]
}
for (const key of ['APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME']) {
  env[key] = path.join(root, key.toLowerCase())
}
Object.assign(env, {
  HOME: root, USERPROFILE: root,
  HEBRI_HOME: path.join(root, 'hebri'), HERMES_HOME: path.join(root, 'hebri'),
  CODEX_HOME: path.join(root, 'codex'), HERMES_SHARED_AUTH_DIR: path.join(root, 'shared'),
  HERMES_DESKTOP_USER_DATA_DIR: path.join(root, 'desktop'),
  HERMES_DESKTOP_ISOLATED_BACKEND: '1', HERMES_DESKTOP_IGNORE_EXISTING: '1',
  HERMES_DESKTOP_HERMES_ROOT: repo, HERMES_DESKTOP_PYTHON: python,
  PYTHONPATH: repo, PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1',
  HERMES_QUIET: '1', HERMES_REDACT_SECRETS: 'true',
})
for (const key of ['HOME', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'HEBRI_HOME', 'CODEX_HOME', 'HERMES_SHARED_AUTH_DIR', 'HERMES_DESKTOP_USER_DATA_DIR']) {
  fs.mkdirSync(env[key], { recursive: true })
}
env.PATH = [path.dirname(python), path.dirname(process.execPath), env.PATH || ''].join(path.delimiter)
const executablePath = path.join(repo, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron')
let app
try {
  app = await electron.launch({ executablePath, args: [path.join(repo, 'apps/desktop')], env, cwd: root, timeout: 60000 })
  const window = await app.firstWindow()
  window.setDefaultTimeout(15000)
  window.on('pageerror', error => console.error('Renderer error:', error.message))
  console.log('Preview profile:', root)
  await window.waitForLoadState('domcontentloaded')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800))
  await window.emulateMedia({ colorScheme: 'dark' })
  const identity = await app.evaluate(({ app }) => ({ name: app.getName(), userData: app.getPath('userData') }))
  if (identity.userData !== env.HERMES_DESKTOP_USER_DATA_DIR) throw new Error('Profile isolation failed')
  await window.getByRole('heading', { name: '1. Connect a model', exact: true }).waitFor({ timeout: 45000 })
  for (let step = 0; step < 4; step++) {
    if (!capture) {
      await window.waitForFunction(name => {
        const img = document.querySelector(`section img[src$="/${name}.png"]`)
        return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
      }, ['providers', 'workspace', 'browser', 'devices'][step], { timeout: 15000 })
    }
    if (step < 3) await window.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await window.getByRole('button', { name: /^(Choose a model|Done)$/ }).click()
  const chooseLater = window.getByRole('button', { name: /choose a provider later/i })
  if (await chooseLater.count()) await chooseLater.click()
  if (capture) {
    const output = path.join(repo, 'apps/desktop/public/getting-started')
    fs.mkdirSync(output, { recursive: true })
    for (const [name, route, marker] of [
      ['providers', '/settings?tab=providers&page=accounts', 'Connect an account'],
      ['workspace', '/settings?tab=config:workspace&page=projects', 'Projects & discovery'],
      ['browser', '/settings?tab=config:browser&page=profile', 'Browser profile'],
      ['devices', '/settings?tab=gateway&page=hebri-devices', 'Hebri devices'],
    ]) {
      await window.evaluate(hash => { window.location.hash = hash }, route)
      await window.getByText(marker, { exact: true }).first().waitFor()
      await window.waitForTimeout(1800)
      if (name === 'providers') await window.getByRole('button', { name: 'Other providers', exact: true }).click()
      await window.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' })
    }
  }
  await window.evaluate(() => { window.location.hash = '/settings?tab=about' })
  await window.getByRole('button', { name: 'Setup guide', exact: true }).click()
  await window.getByRole('heading', { name: '1. Connect a model', exact: true }).waitFor()
  await window.screenshot({ path: path.join(root, 'welcome.png'), scale: 'css' })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 650))
  await window.getByRole('button', { name: 'Next', exact: true }).click()
  await window.getByRole('button', { name: 'Back', exact: true }).click()
  await window.getByRole('button', { name: 'Open Providers', exact: true }).click()
  await window.getByText('Connect an account', { exact: true }).waitFor()
  for (const [step, action, marker] of [
    [1, 'Open Workspace settings', 'Projects & discovery'],
    [2, 'Open Browser settings', 'Browser profile'],
    [3, 'Open Hebri devices', 'Enable device sharing'],
  ]) {
    await window.evaluate(() => { window.location.hash = '/settings?tab=about' })
    await window.getByRole('button', { name: 'Setup guide', exact: true }).click()
    for (let i = 0; i < step; i++) await window.getByRole('button', { name: 'Next', exact: true }).click()
    await window.getByRole('button', { name: action, exact: true }).click()
    await window.getByText(marker, { exact: true }).first().waitFor()
  }
  await window.evaluate(() => { window.location.hash = '/settings?tab=about' })
  await window.getByRole('button', { name: 'Setup guide', exact: true }).click()
  await window.getByRole('button', { name: 'Skip guide', exact: true }).click()
  await window.reload()
  await window.getByRole('button', { name: 'Setup guide', exact: true }).waitFor({ timeout: 30000 })
  if (await window.getByRole('heading', { name: '1. Connect a model', exact: true }).count()) throw new Error('Dismissal did not persist')
  console.log(JSON.stringify({ root, identity, capture, result: 'PASS' }, null, 2))
} catch (error) {
  if (app) {
    const window = await app.firstWindow()
    await window.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {})
    console.error((await window.locator('body').innerText().catch(() => '')).slice(0, 6000))
    console.error(await window.evaluate(() => ({ url: location.href, guide: localStorage.getItem('hebri.desktop.getting-started.v1'), configured: localStorage.getItem('hermes-desktop-onboarded-v1'), skipped: localStorage.getItem('hermes-onboarding-skipped-v1'), guest: window.hermesDesktop?.guestOnboardingEnabled })))
  }
  console.error('Artifacts:', root)
  throw error
} finally {
  if (app) await app.close()
}
