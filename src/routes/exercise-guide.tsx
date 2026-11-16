import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { ExerciseGuide, GuideList } from '@/program/exercise-guides'

// Udhëzuesi i ushtrimit te faqja e ushtrimit (SPEC §0.3g, bordi "Ushtrimi · Udhëzuesi"): Përgatitja, Lëvizja
// hap pas hapi, Tempo dhe fryma, Sinjalet e formës, Gabimet, Këshillat me emrin e ekspertit, Siguria dhe "Pak
// histori" kur ka; secili seksion me "Burimi" poshtë (label dhe lidhja, që hapet jashtë app-it). Shqip dhe
// anglisht nga të dhënat (`program/guides/*.json`). Seksionet bosh nuk dalin: një ushtrim pa udhëzues nuk e
// thërret fare këtë skedar.

/** Rreshti "Burimi: A · B"; çdo burim një lidhje (zona e prekjes mbi 44 px me vendosje negative, që rreshti të mos zgjatet). */
export function SourceLine({ guide, keys }: { guide: ExerciseGuide; keys: string[] }) {
  const { t } = useI18n()
  const unique = [...new Set(keys)].flatMap((key) => (guide.sources[key] ? [guide.sources[key]] : []))
  if (unique.length === 0) return null
  return (
    <p className="text-[13px] leading-[1.35] text-muted-foreground">
      {t('programme.guide.source')}{' '}
      {unique.map((source, index) => (
        <span key={source.url}>
          {index > 0 ? ' · ' : null}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            aria-label={t('programme.guide.sourceOpen', { label: source.label })}
            className="-my-3.5 inline py-3.5 underline decoration-border underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {source.label}
          </a>
        </span>
      ))}
    </p>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="type-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Përgatitja dhe lëvizja: hapat e numëruar. */
function Numbered({ list, guide, id, title }: { list: GuideList; guide: ExerciseGuide; id: string; title: string }) {
  const { lang } = useI18n()
  return (
    <Section id={id} title={title}>
      <ol className="flex flex-col gap-3">
        {list.items.map((item, index) => (
          <li key={item.sq} className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill border border-border text-[13px] font-semibold text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="type-body min-w-0">{item[lang]}</span>
          </li>
        ))}
      </ol>
      <SourceLine guide={guide} keys={list.sources} />
    </Section>
  )
}

function Bullets({ list, guide, id, title }: { list: GuideList; guide: ExerciseGuide; id: string; title: string }) {
  const { lang } = useI18n()
  return (
    <Section id={id} title={title}>
      <ul className="flex flex-col gap-3">
        {list.items.map((item) => (
          <li key={item.sq} className="flex items-start gap-3">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-pill bg-foreground" />
            <span className="type-body min-w-0">{item[lang]}</span>
          </li>
        ))}
      </ul>
      <SourceLine guide={guide} keys={list.sources} />
    </Section>
  )
}

/** Sinjalet e formës të seancës: të parat 3 (`SESSION_CUES`) të udhëzuesit, pa shënimin "Del te seanca". */
export const SESSION_CUES = 3

export function CueList({ cues, marked = false, numbered = false, className }: { cues: GuideList['items']; marked?: boolean; numbered?: boolean; className?: string }) {
  const { t, lang } = useI18n()
  if (numbered) {
    return (
      <ol className={cn('flex flex-col gap-3', className)}>
        {cues.map((cue, index) => (
          <li key={cue.sq} className="flex items-center gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-pill border border-border text-[13px] font-semibold text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="type-body-strong min-w-0">{cue[lang]}</span>
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {cues.map((cue, index) => {
        const inSession = marked && index < SESSION_CUES
        return (
          <li key={cue.sq} className={cn('flex flex-col gap-0.5 border-l-2 py-0.5 pl-3', inSession ? 'border-ember-text' : 'border-border')}>
            <span className="type-body-strong">{cue[lang]}</span>
            {inSession ? <span className="type-caption text-ember-text">{t('programme.guide.cueInSession')}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Seksionet e udhëzuesit, nga Përgatitja te Siguria. "Pak histori" dhe "Më shumë video" i vendos faqja poshtë tyre. */
export function GuideSections({ guide }: { guide: ExerciseGuide }) {
  const { t, lang } = useI18n()
  return (
    <>
      <Numbered list={guide.setup} guide={guide} id="guide-setup" title={t('programme.guide.setup')} />
      <Numbered list={guide.steps} guide={guide} id="guide-steps" title={t('programme.guide.steps')} />
      <Bullets list={guide.breathing} guide={guide} id="guide-breathing" title={t('programme.guide.breathing')} />
      <Section id="guide-cues" title={t('programme.guide.cues')}>
        <CueList cues={guide.cues.items} marked />
        <SourceLine guide={guide} keys={guide.cues.sources} />
      </Section>
      <Section id="guide-mistakes" title={t('programme.guide.mistakes')}>
        <ul className="flex flex-col gap-3">
          {guide.mistakes.items.map((item) => (
            <li key={item.sq} className="flex items-start gap-3">
              <Icon name="mbyll-vrull" size={18} className="mt-1 text-muted-foreground" />
              <span className="type-body min-w-0">{item[lang]}</span>
            </li>
          ))}
        </ul>
        <SourceLine guide={guide} keys={guide.mistakes.sources} />
      </Section>
      {guide.tips.length ? (
        <Section id="guide-tips" title={t('programme.guide.tips')}>
          <ul className="flex flex-col gap-3">
            {guide.tips.map((tip) => (
              <li key={tip.who + tip.text.sq} className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-lg p-3.5')}>
                <span className="text-[13px] leading-[1.35] font-bold">{tip.who}</span>
                <span className="type-body">{tip.text[lang]}</span>
              </li>
            ))}
          </ul>
          <SourceLine guide={guide} keys={guide.tips.flatMap((tip) => tip.sources)} />
        </Section>
      ) : null}
      <Bullets list={guide.safety} guide={guide} id="guide-safety" title={t('programme.guide.safety')} />
    </>
  )
}

/** "Pak histori": karta me burimin poshtë; vetëm kur ka. */
export function GuideHistory({ guide }: { guide: ExerciseGuide }) {
  const { t, lang } = useI18n()
  if (!guide.history) return null
  return (
    <section aria-labelledby="guide-history" className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-3.5')}>
      <h2 id="guide-history" className="type-label text-data">
        {t('programme.guide.history')}
      </h2>
      <p className="m-0 text-base leading-[1.45] font-medium text-foreground">{guide.history.text[lang]}</p>
      <SourceLine guide={guide} keys={guide.history.sources} />
    </section>
  )
}
