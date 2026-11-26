import { useStore } from '@nanostores/react'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { $interfaceMode, INTERFACE_MODES, setInterfaceMode } from '@/store/interface-mode'

/** Presentation only: changing the workspace never submits a prompt or changes agent configuration. */
export function InterfaceModeControl() {
  const { t } = useI18n()
  const mode = useStore($interfaceMode)

  return (
    <div aria-label={t.interfaceMode.title} role="group">
      <SegmentedControl
        onChange={setInterfaceMode}
        options={INTERFACE_MODES.map(id => ({ id, label: t.interfaceMode[id].label }))}
        value={mode}
      />
    </div>
  )
}
