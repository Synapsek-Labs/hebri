import { useAuiState } from '@assistant-ui/react'

import { useI18n } from '@/i18n'

/** Presentation only: never adds a synthetic result to the model's history. */
export function InterruptedActionsNotice() {
  const { t } = useI18n()

  // A boolean selector keeps streamed text from repainting this notice. It is
  // outside tool disclosure, so collapsed groups cannot hide recovery advice.
  const unconfirmed = useAuiState(state =>
    state.message.parts.some(
      part =>
        part.type === 'tool-call' && part.result === undefined && 'interrupted' in part && part.interrupted === true
    )
  )

  if (!unconfirmed) {return null}

  return (
    <p className="px-(--message-text-indent) py-1.5 text-sm leading-relaxed text-(--ui-text-secondary)" role="status">
      {t.assistant.tool.resultInterruptedRecovery}
    </p>
  )
}
