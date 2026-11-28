import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { openWorktreeDialog, registerRepoStatusCwd, repoStatusForCwd } from '@/store/coding-status'
import { notifyError } from '@/store/notifications'
import { openFolderAsProject } from '@/store/projects'

import { ConnectionSwitcher } from '../sidebar/connection-switcher'

/** Explicit workspace actions for a fresh primary draft. Reuse the existing
 * gateway/project controllers; viewing this row never selects or creates one. */
export function WorkspaceControls({ cwd }: { cwd?: null | string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const repo = useStore(repoStatusForCwd(cwd))

  useEffect(() => registerRepoStatusCwd(cwd), [cwd])

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2" data-slot="workspace-controls">
      <ConnectionSwitcher onConnect={() => navigate('/settings?tab=gateway')} showSingle />
      <Button
        className="min-w-0 max-w-64 gap-1.5"
        onClick={() => void openFolderAsProject().catch(error => notifyError(error, t.sidebar.projects.createFailed))}
        size="xs"
        aria-label={cwd || t.commandCenter.openFolder}
        type="button"
        variant="ghost"
      >
        <Codicon aria-hidden name="folder" />
        <span className="truncate">{cwd ? displayPath(cwd) : t.commandCenter.openFolder}</span>
      </Button>
      {repo && cwd && (
        <Button
          className="gap-1.5"
          onClick={() =>
            void openWorktreeDialog({ repoPath: cwd }).catch(error =>
              notifyError(error, t.sidebar.projects.startWorkFailed)
            )
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          <Codicon aria-hidden name="git-branch" />
          {t.sidebar.projects.startWork}
        </Button>
      )}
    </div>
  )
}
