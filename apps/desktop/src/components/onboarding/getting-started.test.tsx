import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { gettingStartedCopy } from '@/i18n/getting-started-copy'
import { $gettingStartedSeen, shouldShowGettingStarted } from '@/store/getting-started'
import { $desktopOnboarding } from '@/store/onboarding'

import { GettingStartedDialog, GettingStartedPages } from './getting-started'

import { DesktopOnboardingOverlay } from '.'

const initialOnboarding = $desktopOnboarding.get()

afterEach(() => {
  cleanup()
  $gettingStartedSeen.set(false)
  $desktopOnboarding.set(initialOnboarding)
  window.location.hash = ''
})

describe('Getting started', () => {
  it('still introduces a fresh installation when readiness discovers a configured runtime', async () => {
    $desktopOnboarding.set({
      ...initialOnboarding,
      configured: true,
      manual: false,
      firstRunSkipped: false,
      providers: []
    })
    const requestGateway = async () => ({ ok: true, provider_configured: true }) as never
    render(<DesktopOnboardingOverlay enabled profile="" requestGateway={requestGateway} />)
    expect(await screen.findByRole('heading', { name: gettingStartedCopy.en.steps[0].title })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
    expect(screen.queryByText('Welcome to Hebri')).toBeNull()
    expect($desktopOnboarding.get().configured).toBe(true)
  })

  it('walks forwards and backwards without configuring a provider or starting work', () => {
    const before = $desktopOnboarding.get()
    const onDone = vi.fn()
    render(<GettingStartedPages firstRun onDone={onDone} />)
    expect(screen.getByRole('heading', { name: gettingStartedCopy.en.steps[0].title })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: gettingStartedCopy.en.steps[1].title })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: gettingStartedCopy.en.steps[0].title })).toBeTruthy()

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    }

    fireEvent.click(screen.getByRole('button', { name: 'Choose a model' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect($desktopOnboarding.get()).toBe(before)
    expect(window.location.hash).toBe('')
  })

  it('persists dismissal and allows explicit replay', () => {
    const onClose = vi.fn()
    const view = render(<GettingStartedDialog onClose={onClose} open />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
    expect($gettingStartedSeen.get()).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
    view.rerender(<GettingStartedDialog onClose={onClose} open={false} />)
    view.rerender(<GettingStartedDialog onClose={onClose} open />)
    expect(screen.getByRole('heading', { name: gettingStartedCopy.en.steps[0].title })).toBeTruthy()
  })

  it.each([
    [0, '#/settings?tab=providers&page=accounts'],
    [1, '#/settings?tab=config:workspace&page=projects'],
    [2, '#/settings?tab=config:browser&page=profile'],
    [3, '#/settings?tab=gateway&page=hebri-devices']
  ])('opens the correct existing settings page for step %s only on request', (step, route) => {
    const onDone = vi.fn()
    render(<GettingStartedPages onDone={onDone} />)

    for (let i = 0; i < Number(step); i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    }

    expect(window.location.hash).toBe('')
    fireEvent.click(screen.getByRole('button', { name: gettingStartedCopy.en.steps[Number(step)].action }))
    expect(window.location.hash).toBe(route)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('leaves manual sign-in and in-progress provider flows uninterrupted', () => {
    const firstRun = { ready: true, manual: false, idle: true, seen: false }
    expect(shouldShowGettingStarted(firstRun)).toBe(true)

    for (const override of [{ ready: false }, { manual: true }, { idle: false }, { seen: true }]) {
      expect(shouldShowGettingStarted({ ...firstRun, ...override })).toBe(false)
    }
  })

  it('provides every guide step and navigation label in every supported locale', () => {
    for (const copy of Object.values(gettingStartedCopy)) {
      expect(copy.steps).toHaveLength(gettingStartedCopy.en.steps.length)

      for (const page of copy.steps) {
        expect(page.title.trim()).not.toBe('')
        expect(page.body.trim()).not.toBe('')
        expect(page.action.trim()).not.toBe('')
      }

      expect(copy.chooseModel.trim()).not.toBe('')
      expect(copy.skip.trim()).not.toBe('')
    }
  })
})
