import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { finishGettingStarted } from '@/store/getting-started'

const SCREENS = ['providers', 'workspace', 'browser', 'devices'] as const

const DESTINATIONS = [
  '/settings?tab=providers&page=accounts',
  '/settings?tab=config:workspace&page=projects',
  '/settings?tab=config:browser&page=profile',
  '/settings?tab=gateway&page=hebri-devices'
] as const

/** Offline, deterministic guide. It never configures a provider or starts work. */
export function GettingStartedPages({
  onDone,
  firstRun = false,
  showActions = !firstRun
}: {
  onDone: () => void
  firstRun?: boolean
  showActions?: boolean
}) {
  const { t } = useI18n()
  const g = t.gettingStarted
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const page = g.steps[step]

  useEffect(() => {
    heading.current?.focus()
  }, [step])

  return (
    <section
      className="grid min-w-0 gap-4"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onDone()
        }
      }}
    >
      <div className="flex items-center gap-3">
        <BrandMark className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{g.title}</p>
          <p className="text-xs text-muted-foreground">{g.subtitle}</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {step + 1} / {SCREENS.length}
        </span>
      </div>
      <img
        alt={page.title}
        className="aspect-[16/9] w-full rounded-lg border border-(--ui-stroke-tertiary) object-contain"
        src={`${import.meta.env.BASE_URL}getting-started/${SCREENS[step]}.png`}
      />
      <div aria-live="polite" className="grid gap-2">
        <h2 className="text-lg font-semibold" ref={heading} tabIndex={-1}>
          {page.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{page.body}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{g.imageNote}</p>
      </div>
      {showActions && (
        <Button
          onClick={() => {
            onDone()
            window.location.hash = DESTINATIONS[step]
          }}
          variant="outline"
        >
          {page.action}
        </Button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={onDone} variant="text">
          {g.skip}
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)} variant="ghost">
              {g.back}
            </Button>
          )}
          <Button onClick={() => (step === SCREENS.length - 1 ? onDone() : setStep(step + 1))}>
            {step === SCREENS.length - 1 ? (firstRun ? g.chooseModel : g.finish) : g.next}
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Replayed explicitly from About; uses the same pages as first-run setup. */
export function GettingStartedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()

  const close = () => {
    finishGettingStarted()
    onClose()
  }

  return (
    <Dialog
      onOpenChange={value => {
        if (!value) {
          close()
        }
      }}
      open={open}
    >
      <DialogContent className="max-w-3xl">
        <DialogTitle className="sr-only">{t.gettingStarted.title}</DialogTitle>
        <DialogDescription className="sr-only">{t.gettingStarted.subtitle}</DialogDescription>
        <GettingStartedPages onDone={close} />
      </DialogContent>
    </Dialog>
  )
}
