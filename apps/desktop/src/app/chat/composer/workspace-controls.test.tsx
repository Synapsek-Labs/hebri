import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

const handles = vi.hoisted(() => ({
  folder: vi.fn(async () => undefined),
  worktree: vi.fn(async () => undefined),
  register: vi.fn(() => () => undefined)
}))

const status = atom<object | null>(null)

vi.mock('@/store/projects', () => ({ openFolderAsProject: handles.folder }))
vi.mock('@/store/coding-status', () => ({
  openWorktreeDialog: handles.worktree,
  registerRepoStatusCwd: handles.register,
  repoStatusForCwd: () => status
}))
vi.mock('../sidebar/connection-switcher', () => ({ ConnectionSwitcher: () => null }))

const { WorkspaceControls } = await import('./workspace-controls')

afterEach(() => {
  cleanup()
  status.set(null)
  vi.clearAllMocks()
})

function mount(cwd: string) {
  return render(
    <MemoryRouter>
      <I18nProvider configClient={null} initialLocale="en">
        <WorkspaceControls cwd={cwd} />
      </I18nProvider>
    </MemoryRouter>
  )
}

it('does not create a workspace on render and offers no worktree for a non-repository', () => {
  mount('/documents')
  expect(handles.folder).not.toHaveBeenCalled()
  expect(handles.worktree).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'New worktree' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '/documents' }))
  expect(handles.folder).toHaveBeenCalledOnce()
})

it('opens the existing worktree dialog for this composer folder, never a different project', () => {
  status.set({ branch: 'main' })
  mount('/selected-project')
  fireEvent.click(screen.getByRole('button', { name: 'New worktree' }))
  expect(handles.worktree).toHaveBeenCalledWith({ repoPath: '/selected-project' })
  expect(handles.folder).not.toHaveBeenCalled()
})
