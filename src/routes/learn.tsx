import { useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/layout/empty-state'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { learnPage, type SeenEntry } from '@/data/learn'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { inLang } from '@/learn/facts'
import { QUIZ_SIZE } from '@/learn/quiz'
import { cn } from '@/lib/cn'
import { achievementName } from './achievement-format'
import { factSource, factText, factTopic } from './learn-format'
import { StreakDots } from './learn-parts'
import { QuizStories } from './quiz-stories'
import { SHEET } from './sheet-params'
import { weekRangeText } from './week-format'

// Faqja Mëso (Progresi › Mëso; V56, SPEC §0.3e, bordi "Progresi › Mëso"): kuizi i javës kur është hapur (e diela
// 20:00 deri të hënën), kërkimi te faktet (teksti, emri i ushtrimit ose i ushqimit), kuizet e kaluara me rezultatin,
// vargu i kuizit dhe faktet që ke parë (më të rejat sipër) me burimin. Pa fakte, gjendja bosh tregon ku dalin. Kuizi
// hapet si story me parametrin e adresës (`?fleta=kuizi`), që butoni mbrapa i Android-it ta mbyllë.

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Teksti pa shenjat e shkronjave dhe me shkronja të vogla: "tërshëra" gjen "Tërshërë", "ë" = "e". */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()

/** Fakti gjendet nga teksti (të dyja gjuhët), tema (ushtrimi, ushqimi) dhe burimi. */
function matches(i18n: I18n, entry: SeenEntry, query: string): boolean {
  const wanted = plain(query.trim())
  if (!wanted) return true
  const { fact } = entry
  const haystack = [inLang(fact.text, 'sq'), inLang(fact.text, 'en'), factTopic(i18n, fact), fact.topic.kind === 'exercise' ? fact.topic.exercise : '', fact.source.label].join(' ')
  return plain(haystack).includes(wanted)
}

export function LearnPage() {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const searchId = useId()
  const data = useLocalQuery(() => learnPage(store), [])
  const quizOpen = params.get(SHEET) === 'kuizi'

  const header = (
    <BackHeader
      title={t('learn.page.title')}
      back={t('learn.page.back')}
      fallback="/progresi"
      actions={data ? <span className="text-[13px] text-muted-foreground tabular-nums">{t('learn.page.count', { count: data.seen.length })}</span> : undefined}
    />
  )
  if (!data) {
    return (
      <div className="flex flex-col gap-3.5">
        {header}
        <div aria-hidden className="h-72 rounded-lg bg-surface" />
      </div>
    )
  }
  const shown = data.seen.filter((entry) => matches(i18n, entry, query))
  const empty = data.seen.length === 0 && data.quizzes.length === 0
  const name = achievementName(i18n, 'quiz_4')
  return (
    <div className="flex flex-col gap-3.5 pb-4">
      {header}

      {data.openQuiz ? (
        <section aria-labelledby="learn-quiz" className={cn(surfaceClass, 'flex flex-col gap-2 rounded-[20px] p-4')}>
          <span className="type-label text-muted-foreground">{t('learn.quiz.title')}</span>
          <h2 id="learn-quiz" className="m-0 font-display text-[28px] leading-[1] font-extrabold uppercase">
            {t('learn.quizCard.title')}
          </h2>
          <p className="m-0 text-sm text-muted-foreground tabular-nums">
            {weekRangeText(i18n, data.openQuiz)} · {t('learn.quiz.time')}
          </p>
          <Button variant="primary" size="lg" className="mt-1 w-full" onClick={() => setParams({ [SHEET]: 'kuizi' })}>
            {t('learn.quizCard.start')}
          </Button>
        </section>
      ) : null}

      {empty ? (
        <EmptyState
          title={t('learn.page.emptyTitle')}
          intro={t('learn.page.emptyIntro')}
          items={[
            { title: t('learn.page.emptyToday'), text: t('learn.page.emptyTodayText'), to: '/' },
            { title: t('learn.page.emptyRest'), text: t('learn.page.emptyRestText') },
            { title: t('learn.page.emptyFood'), text: t('learn.page.emptyFoodText'), to: '/ushqimi' },
          ]}
        />
      ) : (
        <>
          <span className="flex h-12 items-center gap-2 rounded-md border border-border bg-surface pr-1 pl-3 focus-within:border-foreground">
            <Icon name="kerko" size={18} className="shrink-0 text-muted-foreground" />
            <label htmlFor={searchId} className="sr-only">
              {t('learn.page.search')}
            </label>
            <input
              id={searchId}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t('learn.page.search')}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-11 min-w-0 flex-1 appearance-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => setQuery('')}
                className="flex size-11 shrink-0 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
              >
                <Icon name="mbyll-vrull" size={18} />
              </button>
            ) : null}
          </span>

          {data.quizzes.length > 0 && !query ? (
            <>
              <section aria-labelledby="learn-quizzes" className="flex flex-col gap-2">
                <h2 id="learn-quizzes" className="type-label text-muted-foreground">
                  {t('learn.page.quizzes')}
                </h2>
                <ul className={cn(surfaceClass, 'm-0 flex list-none flex-col rounded-lg px-4 py-0')}>
                  {data.quizzes.map((quiz) => {
                    const week = quiz.programWeek !== null ? t('plan.week', { week: quiz.programWeek }) : weekRangeText(i18n, quiz.monday)
                    const date = fmt.date(atNoon(quiz.closedOn), { weekday: false })
                    return (
                      <li
                        key={quiz.monday}
                        aria-label={t('learn.page.quizSpoken', { week, score: quiz.score, total: QUIZ_SIZE, date })}
                        className="flex min-h-[52px] items-center gap-3 border-b border-border last:border-b-0"
                      >
                        <span aria-hidden className="min-w-0 flex-1 type-body-strong">
                          {week}
                        </span>
                        <span aria-hidden className="font-display text-xl font-bold tabular-nums">
                          {t('learn.page.quizScore', { score: quiz.score, total: QUIZ_SIZE })}
                        </span>
                        <span aria-hidden className="w-[76px] text-right text-[13px] text-muted-foreground tabular-nums">
                          {date}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section aria-labelledby="learn-streak" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4')}>
                <h2 id="learn-streak" className="type-label text-muted-foreground">
                  {t('learn.page.streak')}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="font-display text-[56px] leading-[0.85] font-extrabold tabular-nums">{data.streak}</span>
                  <span className="text-sm leading-[1.2] text-muted-foreground">{t('learn.page.streakWeeks', { count: data.streak })}</span>
                  <div className="ml-auto">
                    <StreakDots dots={data.dots} labels />
                  </div>
                </div>
                <p className="m-0 text-[13px] text-muted-foreground">
                  {data.achievement.earnedOn
                    ? t('learn.quiz.earned', { name, date: fmt.date(atNoon(data.achievement.earnedOn), { weekday: false }) })
                    : t('learn.quiz.toAchievement', { count: data.achievement.target - data.achievement.current, name })}
                </p>
              </section>
            </>
          ) : null}

          <section aria-labelledby="learn-seen" className="flex flex-col gap-2">
            <h2 id="learn-seen" className="type-label text-muted-foreground">
              {t('learn.page.seen')}
            </h2>
            {shown.length === 0 ? (
              <p className="type-body text-muted-foreground">{query ? t('learn.page.noResults', { query: query.trim() }) : t('learn.page.emptyIntro')}</p>
            ) : (
              <ul className={cn(surfaceClass, 'm-0 flex list-none flex-col rounded-lg px-4 py-0')}>
                {shown.map((entry) => (
                  <SeenItem key={entry.fact.id} entry={entry} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {quizOpen ? <QuizStories onClose={() => navigate(-1)} onLearn={() => navigate(-1)} /> : null}
    </div>
  )
}

function SeenItem({ entry }: { entry: SeenEntry }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { fact } = entry
  const source = factSource(i18n, fact)
  return (
    <li className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <span className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground tabular-nums">
        <span>{fmt.date(atNoon(entry.date), { weekday: false })}</span>
        <span className="min-w-0 truncate">
          {t(`learn.page.place.${entry.place}`)} · {factTopic(i18n, fact)}
        </span>
      </span>
      <p className="m-0 text-[15px] leading-[1.45] font-medium">{factText(i18n, fact)}</p>
      <p className="m-0 text-[13px] leading-[1.35] text-muted-foreground">
        {t('programme.guide.source')}{' '}
        <a
          href={fact.source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={t('learn.source.openSpoken', { label: source })}
          className="-my-3.5 inline py-3.5 underline decoration-border underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {source}
        </a>
      </p>
    </li>
  )
}
