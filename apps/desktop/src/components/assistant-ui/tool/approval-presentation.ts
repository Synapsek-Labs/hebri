import type { Translations } from '@/i18n/types'
import type { ApprovalRequest } from '@/store/prompts'

type ApprovalCopy = Translations['assistant']['approval']

const scriptReason =
  'execute_code script execution. The script can spawn subprocesses or mutate files without passing through terminal command approval; approval is one-shot for this run.'

/** Presentation only: never infer a safe purpose from code, comments, or a command's first step. */
export function approvalPresentation(request: ApprovalRequest, copy: ApprovalCopy) {
  const script = /^execute_code <<'PY'\r?\n[\s\S]*\r?\nPY$/.test(request.command.trim())
  const description = request.description.trim()
  const generic = !description || /^(dangerous command|approval required|manual approval)$/i.test(description)

  return {
    title: script ? copy.scriptTitle : copy.actionTitle,
    reason: script && description === scriptReason ? copy.scriptReason : generic ? copy.unknownReason : description,
    // Keep additional warnings intact even for a recognized script envelope.
    scriptWarning: script && description !== scriptReason ? copy.scriptReason : null
  }
}
