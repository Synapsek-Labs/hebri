import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { onComposerInsertRequest, onComposerSubmitRequest } from '@/app/chat/composer/focus'
import { ComposerScopeProvider, MAIN_COMPOSER_SCOPE } from '@/app/chat/composer/scope'
import { I18nProvider } from '@/i18n'
import { setInterfaceMode } from '@/store/interface-mode'

import { Intro } from './intro'

afterEach(() => {
  cleanup()
  setInterfaceMode('advanced')
  vi.unstubAllGlobals()
})

it('offers an editable starter to its own composer without submitting or requesting a model', async () => {
  setInterfaceMode('simple')
  const insert = vi.fn()
  const submit = vi.fn()
  const fetch = vi.fn()
  const stopInsert = onComposerInsertRequest(insert)
  const stopSubmit = onComposerSubmitRequest(submit)
  vi.stubGlobal('fetch', fetch)

  try {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ComposerScopeProvider value={{ ...MAIN_COMPOSER_SCOPE, target: 'tile:lab-test' }}>
          <Intro />
        </ComposerScopeProvider>
      </I18nProvider>
    )
    expect(screen.getByRole('heading', { name: 'What would you like to get done?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Make a plan' }))
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith({
      target: 'tile:lab-test',
      mode: 'block',
      text: 'Help me turn this goal into a practical plan:'
    })
    expect(submit).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    stopInsert()
    stopSubmit()
  }
})
