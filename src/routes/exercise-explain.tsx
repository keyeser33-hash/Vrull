import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { aiMonth } from '@/data/ai-usage'
import { exerciseExplainRemote, store, useLocalQuery } from '@/data/app-data'
import { type ExplainError, type ExplainSubject, explainBlock, explainExercise, savedExplanation } from '@/data/exercise-explain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/use-online'

// "Shpjegoje më shumë" (V56, SPEC §0.3e; bordi "Ushtrimi · AI"): butoni pa prush poshtë faqes, me "Me AI ·
// hyn te kufiri yt i muajit"; shpjegimi vjen me etiketën "Shpjeguar nga AI" dhe një shënim se faktet me burim
// janë më sipër; "Mbyll shpjegimin" e fsheh. Pa internet ose pas kufirit butoni thotë pse (një shpjegim i
// ruajtur në telefon hapet gjithsesi). Teksti ruhet për ushtrimin dhe gjuhën (`data/exercise-explain.ts`).
export function ExplainMore({ subject }: { subject: ExplainSubject }) {
  const { t, fmt, lang } = useI18n()
  const language = lang === 'en' ? 'en' : 'sq'
  const online = useOnline()
  const [paragraphs, setParagraphs] = useState<string[] | null>(null)
  const [error, setError] = useState<ExplainError | null>(null)
  const [busy, setBusy] = useState(false)
  const state = useLocalQuery(async () => ({ block: await explainBlock(store, online), saved: (await savedExplanation(store, subject.key, language)) !== null, month: await aiMonth(store) }), [online, subject.key, language])

  if (paragraphs) {
    return (
      <>
        <section aria-label={t('programme.explain.label')} className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-lg p-3.5')}>
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Icon name="shkendija" size={14} />
            {t('programme.explain.by')}
          </span>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="m-0 text-[15px] leading-[1.5] text-foreground">
              {paragraph}
            </p>
          ))}
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('programme.explain.disclaimer')}</span>
        </section>
        <Button variant="outline" size="lg" className="w-full" onClick={() => setParagraphs(null)}>
          {t('programme.explain.close')}
        </Button>
      </>
    )
  }

  const blocked = state && !state.saved ? state.block : null
  const reason = blocked === 'offline' ? t('programme.explain.offline') : blocked === 'limit' ? t('programme.explain.limit', { date: fmt.date(state!.month.resetsOn, { weekday: false }) }) : null
  const failed = error === 'offline' || error === 'limit' ? null : error
  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await explainExercise(store, exerciseExplainRemote, subject, language, navigator.onLine)
      if (result.ok) setParagraphs(result.paragraphs)
      else setError(result.error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="lg" className="w-full" disabled={busy || !state || !!blocked} aria-describedby="explain-note" onClick={() => void open()}>
        {busy ? t('programme.explain.loading') : t('programme.explain.button')}
      </Button>
      <p id="explain-note" role={failed ? 'alert' : undefined} className={cn('text-center text-[13px] leading-[1.35]', failed ? 'text-danger' : 'text-muted-foreground')}>
        {failed ? t(failed === 'unauthorized' ? 'programme.explain.unauthorized' : 'programme.explain.error') : (reason ?? t('programme.explain.hint'))}
      </p>
    </div>
  )
}
