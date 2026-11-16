import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { type StoryPage, StoryViewer } from '@/components/ui/story-viewer'
import { store } from '@/data/app-data'
import { type DayFact, markFactSeen } from '@/data/learn'
import { useI18n } from '@/i18n/use-i18n'
import type { Fact } from '@/learn/facts'
import { cn } from '@/lib/cn'
import { factMore, factSource, factText, factTopic } from './learn-format'
import { TopicChip } from './learn-parts'

// "A e dije?" te Sot si story (V57, SPEC §0.3e, §0.3f; bordi "Story · A e dije?"): tema, fakti, burimi dhe "Më shumë",
// që hap shpjegimin dhe lidhjen e burimit jashtë app-it. Me shikuesin e story-ve: pa kalim me kohë, pa tinguj e
// festime. Fakti shënohet i parë kur story hapet (një rresht për ditë ushqimi te `learn_events`).

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Lidhja e burimit, që hapet jashtë app-it (zona e prekjes 44 px). */
function SourceLink({ fact, className }: { fact: Fact; className?: string }) {
  const i18n = useI18n()
  const { t } = i18n
  return (
    <a
      href={fact.source.url}
      target="_blank"
      rel="noreferrer"
      aria-label={t('learn.source.openSpoken', { label: factSource(i18n, fact) })}
      className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full', className)}
    >
      {t('learn.source.open')}
      <Icon name="jashte" size={18} />
    </a>
  )
}

/** Story "A e dije?" i Sot: shënohet i parë kur hapet (një rresht për ditë te `learn_events`). */
export function FactStory({ entry, onClose }: { entry: DayFact; onClose: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const [open, setOpen] = useState(false)
  const { fact, date } = entry
  useEffect(() => {
    if (!entry.seen) void markFactSeen(store, 'today', date, fact.id)
  }, [entry.seen, date, fact.id])
  const more = factMore(i18n, fact)
  const page: StoryPage = {
    key: fact.id,
    label: t('ui.fact.title'),
    open: true,
    children: (
      <>
        <div className="flex flex-1 flex-col gap-3.5 px-4 pt-2">
          <TopicChip fact={fact} label={factTopic(i18n, fact)} />
          <span className="type-label text-data">{t('ui.fact.title')}</span>
          <p className="m-0 font-display text-[28px] leading-[1.25] font-semibold">{factText(i18n, fact)}</p>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('ui.fact.source', { source: `${factSource(i18n, fact)} · ${fact.source.title}` })}</span>
          {open && more ? <p className="m-0 text-[17px] leading-[1.45]">{more}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col px-4 pt-3 pb-7">
          {open ? (
            <SourceLink fact={fact} />
          ) : (
            <Button variant="outline" size="lg" className="w-full" onClick={() => setOpen(true)}>
              {t('ui.fact.more')}
            </Button>
          )}
        </div>
      </>
    ),
  }
  return <StoryViewer title={t('ui.fact.title')} subtitle={fmt.date(atNoon(date))} pages={[page]} index={0} onIndex={() => undefined} onClose={onClose} />
}
