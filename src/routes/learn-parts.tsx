import { Icon } from '@/components/ui/icons'
import type { QuizDot } from '@/data/learn'
import { useI18n } from '@/i18n/use-i18n'
import type { Fact } from '@/learn/facts'
import { cn } from '@/lib/cn'
import { factIcon } from './learn-format'

// Pjesët e përbashkëta të Mëso-s (SPEC §0.3e): çipi i temës (story "A e dije?" dhe kuizi) dhe rrathët e vargut të
// kuizit (hyrja, rezultati, faqja Mëso; bordet "Kuizi · Hyrja", "Kuizi · Rezultati", "Progresi › Mëso").

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Çipi i temës: pilulë jo-interaktive 28 px me ikonën. */
export function TopicChip({ fact, label }: { fact: Fact; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-pill border border-border px-2.5 text-[13px] leading-none whitespace-nowrap text-foreground">
      <Icon name={factIcon(fact)} size={14} />
      {label}
    </span>
  )
}

/** Rrathët e vargut: 28 px; i mbyllur i mbushur me shenjën, sot me unazë, ato që vijnë me vijë të ndërprerë. */
export function StreakDots({ dots, labels }: { dots: readonly QuizDot[]; labels?: boolean }) {
  const { t, fmt } = useI18n()
  return (
    <ol className="m-0 flex list-none gap-3 p-0">
      {dots.map((dot) => {
        const date = fmt.date(atNoon(dot.sunday), { weekday: false, short: true })
        const spoken = t(dot.state === 'done' ? 'learn.quiz.dotDone' : dot.state === 'open' ? 'learn.quiz.dotOpen' : 'learn.quiz.dotAhead', { date })
        return (
          <li key={dot.sunday} aria-label={spoken} className="flex flex-col items-center gap-1">
            <span
              aria-hidden
              className={cn(
                'box-border flex size-7 items-center justify-center rounded-pill',
                dot.state === 'done' ? 'bg-foreground text-background' : dot.state === 'open' ? 'border-2 border-foreground' : 'border-2 border-dashed border-subtle',
              )}
            >
              {dot.state === 'done' ? <Icon name="zgjedhur" size={16} /> : null}
            </span>
            {labels ? (
              <span aria-hidden className="text-[11px] leading-none text-muted-foreground tabular-nums">
                {date}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
