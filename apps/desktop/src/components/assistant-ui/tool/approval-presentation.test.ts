import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'

import { approvalPresentation } from './approval-presentation'

const copy = en.assistant.approval
const command = "execute_code <<'PY'\nprint('test')\nPY"

const description =
  'execute_code script execution. The script can spawn subprocesses or mutate files without passing through terminal command approval; approval is one-shot for this run.'

describe('approvalPresentation', () => {
  it('translates the known Python warning without interpreting or executing the script', () => {
    const request = { sessionId: 'qa', command, description }
    expect(approvalPresentation(request, copy)).toEqual({
      title: copy.scriptTitle,
      reason: copy.scriptReason,
      scriptWarning: null
    })
    expect(request.command).toBe(command)
  })

  it('preserves custom safety explanations instead of replacing them with a generic summary', () => {
    const reason = description + ' Also sends data to an external host.'
    expect(approvalPresentation({ sessionId: 'qa', command, description: reason }, copy).reason).toBe(reason)
  })

  it.each(['', 'dangerous command', 'manual approval', 'approval required'])(
    'admits missing context for %j instead of inventing a purpose',
    reason => {
      expect(
        approvalPresentation({ sessionId: 'qa', command: 'unknown operation', description: reason }, copy).reason
      ).toBe(copy.unknownReason)
    }
  )
})
