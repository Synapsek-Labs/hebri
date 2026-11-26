import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $approvalModes } from '@/store/approval-mode'
import { $interfaceMode, modeBound, setInterfaceMode } from '@/store/interface-mode'
import { $currentModel, $currentProvider } from '@/store/session'

import { InterfaceModeControl } from './interface-mode-control'

afterEach(() => {
  cleanup()
  setInterfaceMode('advanced')
  vi.unstubAllGlobals()
})

it('switches presentation without changing the model, approval policy or saved pane preference', () => {
  setInterfaceMode('advanced')
  $currentModel.set('local-test-model')
  $currentProvider.set('local-test-provider')
  $approvalModes.set({ default: 'manual' })
  const preference = atom(true)
  const terminal = modeBound('terminalOpen', preference, value => preference.set(value))
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  render(
    <I18nProvider configClient={null} initialLocale="en">
      <InterfaceModeControl />
    </I18nProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: 'Simple' }))
  expect($interfaceMode.get()).toBe('simple')
  expect(screen.getByRole('button', { name: 'Simple' }).getAttribute('aria-pressed')).toBe('true')
  expect(terminal.get()).toBe(false)
  expect(preference.get()).toBe(true)
  expect($currentModel.get()).toBe('local-test-model')
  expect($currentProvider.get()).toBe('local-test-provider')
  expect($approvalModes.get()).toEqual({ default: 'manual' })

  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
  expect(terminal.get()).toBe(true)
  expect($currentModel.get()).toBe('local-test-model')
  expect($currentProvider.get()).toBe('local-test-provider')
  expect($approvalModes.get()).toEqual({ default: 'manual' })
  expect(fetch).not.toHaveBeenCalled()
})
