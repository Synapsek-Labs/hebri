import { Codecs, persistentAtom } from '@/lib/persisted'
import { $desktopOnboarding } from '@/store/onboarding'

// Capture before the readiness check can discover an existing local runtime.
// Returning installations retain the old setup/skip markers and are not nagged.
export const gettingStartedEligibleAtLaunch =
  $desktopOnboarding.get().configured !== true && !$desktopOnboarding.get().firstRunSkipped

// Installation-wide presentation preference. It carries no account, task or
// provider state; switching profiles must not restart the introduction.
export const $gettingStartedSeen = persistentAtom('hebri.desktop.getting-started.v1', false, Codecs.bool)

export function finishGettingStarted(): void {
  $gettingStartedSeen.set(true)
}

export function shouldShowGettingStarted(state: {
  ready: boolean
  manual: boolean
  idle: boolean
  seen: boolean
}): boolean {
  return state.ready && !state.manual && state.idle && !state.seen
}
