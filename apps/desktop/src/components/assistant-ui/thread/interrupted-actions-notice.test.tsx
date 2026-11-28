import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ message: { parts: [] as Array<Record<string, unknown>> } }))
vi.mock('@assistant-ui/react', () => ({ useAuiState: (select: (value: typeof state) => unknown) => select(state) }))

import { InterruptedActionsNotice } from './interrupted-actions-notice'

afterEach(cleanup)

it('keeps recovery visible for unconfirmed interrupted actions, then clears it when their real results arrive', () => {
  state.message.parts = [
    { type: 'tool-call', interrupted: true, result: undefined },
    { type: 'tool-call', interrupted: true, result: undefined }
  ]
  const view = render(<InterruptedActionsNotice />)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status').textContent).toContain('check before retrying')
  state.message.parts = state.message.parts.map(part => ({ ...part, result: { success: true } }))
  view.rerender(<InterruptedActionsNotice />)
  expect(screen.queryByRole('status')).toBeNull()

  state.message.parts = [{ type: 'tool-call', result: undefined }]
  view.rerender(<InterruptedActionsNotice />)
  expect(screen.queryByRole('status')).toBeNull()
})
