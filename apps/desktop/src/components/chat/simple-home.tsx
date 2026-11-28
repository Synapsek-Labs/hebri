import { requestComposerInsert } from '@/app/chat/composer/focus'
import { useComposerScope } from '@/app/chat/composer/scope'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { simpleHomeCopy } from '@/i18n/simple-home'

/** A local starting point, not a generated suggestion or a second prompt pipeline. */
export function SimpleHome() {
  const { locale } = useI18n()
  const { target } = useComposerScope()
  const copy = simpleHomeCopy[locale]

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-6 py-8 text-center">
      <p className="text-xs font-medium tracking-widest text-(--ui-text-tertiary)">Hebri</p>
      <h1 className="text-3xl leading-tight font-medium tracking-tight text-(--ui-text-primary)">{copy.title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-(--ui-text-secondary)">{copy.description}</p>
      <div className="flex max-w-full flex-wrap justify-center gap-2">
        {copy.starters.map(starter => (
          <Button
            key={starter.label}
            onClick={() => requestComposerInsert(starter.prompt, { target })}
            size="lg"
            type="button"
            variant="outline"
          >
            {starter.label}
          </Button>
        ))}
      </div>
    </section>
  )
}
