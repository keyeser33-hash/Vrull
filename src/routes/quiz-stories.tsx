import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { type StoryPage, StoryViewer } from '@/components/ui/story-viewer'
import { store } from '@/data/app-data'
import { quizView, type QuizView, saveQuiz } from '@/data/learn'
import { useI18n } from '@/i18n/use-i18n'
import type { Fact } from '@/learn/facts'
import { QUIZ_SIZE } from '@/learn/quiz'
import { cn } from '@/lib/cn'
import { achievementName } from './achievement-format'
import { factIcon, factSource, factText, factTopic, quizOptions, quizQuestion, quizTopic } from './learn-format'
import { StreakDots, TopicChip } from './learn-parts'
import { weekRangeText } from './week-format'

// Kuizi i së dielës si story (V56, V57, SPEC §0.3e; bordet "Kuizi · Hyrja", "Pyetja", "Përgjigja", "Rezultati"): 7
// ekrane me shikuesin e story-ve (hyrja, 5 pyetjet, rezultati), pa kalim me kohë, pa tinguj e festime. Prekja e
// përgjigjes është veprimi: pastaj dalin shpjegimi me burimin dhe "Tjetra"; e sakta me ikonë dhe fjalë, jo me ngjyrë.
// Rrëshqitja lëviz mes pyetjeve të përgjigjura. Rezultati ruhet me javën (`saveQuiz`) para ekranit të fundit.

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Kuizi i së dielës si story. Lexon kuizin një herë kur hapet, që pyetjet të mos ndryshojnë gjatë kuizit. */
export function QuizStories({ onClose, onLearn }: { onClose: () => void; onLearn: () => void }) {
  const [view, setView] = useState<QuizView | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void quizView(store).then(
      (loaded) => !cancelled && setView(loaded),
      () => !cancelled && setView(null),
    )
    return () => {
      cancelled = true
    }
  }, [])
  // Jashtë dritares ose me më pak se 5 fakte (p.sh. një adresë e vjetër) story mbyllet vetë.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (view === null || (view && !view.facts)) close.current()
  }, [view])
  if (view && view.facts) return <QuizFlow view={view} facts={view.facts} onClose={onClose} onLearn={onLearn} />
  return null
}

const RESULT = QUIZ_SIZE + 1
const LETTERS = ['A', 'B', 'C', 'D']

function QuizFlow({ view, facts, onClose, onLearn }: { view: QuizView; facts: Fact[]; onClose: () => void; onLearn: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const [answers, setAnswers] = useState<(number | null)[]>(() => facts.map((_, index) => view.done?.answers[index]?.chosen ?? null))
  const [index, setIndex] = useState(view.done ? RESULT : 0)
  const [result, setResult] = useState<QuizView | null>(view.done ? view : null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [now] = useState(() => new Date())
  const saving = useRef(false)

  const week = view.programWeek !== null ? t('plan.week', { week: view.programWeek }) : weekRangeText(i18n, view.monday)
  const title = view.programWeek !== null ? t('learn.quiz.header', { week }) : t('learn.quiz.title')

  const finish = async () => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setFailed(false)
    try {
      if (!view.done) await saveQuiz(store, view.monday, facts, answers.map((answer) => answer ?? -1))
      const saved = await quizView(store)
      setResult(saved && saved.done ? saved : null)
      if (!saved?.done) throw new Error('kuizi nuk u ruajt')
      setIndex(RESULT)
    } catch {
      setFailed(true)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const go = (target: number) => {
    if (target >= RESULT && !result) return void finish()
    setIndex(Math.min(target, RESULT))
  }
  const answer = (question: number, chosen: number) => {
    if (answers[question] !== null || result) return
    setAnswers((current) => current.map((value, position) => (position === question ? chosen : value)))
  }

  const pages: StoryPage[] = [
    {
      key: 'intro',
      label: t('learn.quiz.title'),
      open: true,
      children: <Intro view={view} facts={facts} week={week} onStart={() => setIndex(1)} />,
    },
    ...facts.map(
      (fact, position): StoryPage => ({
        key: fact.id,
        label: t('learn.quiz.question', { n: position + 1 }),
        open: answers[position] === null,
        children: (
          <Question
            fact={fact}
            chosen={answers[position]}
            onAnswer={(chosen) => answer(position, chosen)}
            onNext={() => go(position + 2)}
            busy={busy}
            failed={failed && position === QUIZ_SIZE - 1}
          />
        ),
      }),
    ),
    {
      key: 'result',
      label: t('learn.quiz.result'),
      open: true,
      children: result ? <Result view={result} facts={facts} week={week} onFinish={onClose} onLearn={onLearn} /> : null,
    },
  ]
  const counter = index >= 1 && index <= QUIZ_SIZE ? `${index} / ${QUIZ_SIZE}` : index === RESULT ? `${QUIZ_SIZE} / ${QUIZ_SIZE}` : undefined
  return <StoryViewer title={title} subtitle={fmt.date(now)} counter={counter} pages={pages} index={index} onIndex={go} onClose={onClose} />
}

/** Hyrja: titulli, java, temat, vargu me rrathët dhe "Fillo" (veprimi kryesor). */
function Intro({ view, facts, week, onStart }: { view: QuizView; facts: Fact[]; week: string; onStart: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const topics = [...new Map(facts.map((fact) => [factTopic(i18n, fact), fact])).entries()]
  const range = view.programWeek !== null ? t('learn.quiz.range', { week, range: weekRangeText(i18n, view.monday) }) : week
  return (
    <div className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-speed-lines mask-fade-down" />
      <div className="relative flex flex-1 flex-col gap-3 px-4 pt-2">
        <h1 className="m-0 font-display text-[64px] leading-[0.9] font-extrabold uppercase">{t('learn.quiz.title')}</h1>
        <p className="m-0 text-[15px] text-muted-foreground tabular-nums">{range}</p>
        <p className="m-0 text-[19px] leading-[1.3] font-medium">{t('learn.quiz.lead')}</p>
        <ul aria-label={t('learn.quiz.topics')} className="m-0 mt-auto mb-4 flex list-none flex-wrap gap-x-2 gap-y-3 p-0">
          {topics.map(([label, fact]) => (
            <li key={label} className="flex w-[66px] flex-col items-center gap-1.5">
              <span aria-hidden className="flex size-12 items-center justify-center rounded-pill border border-border bg-surface">
                <Icon name={factIcon(fact)} size={20} />
              </span>
              <span className="line-clamp-2 w-full text-center text-xs leading-[1.2]">{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative flex shrink-0 flex-col gap-3 px-4 pt-3 pb-7">
        <p className="m-0 text-[15px]">{view.streakBefore > 0 ? t('learn.quiz.streakIntro', { count: view.streakBefore, next: view.streakBefore + 1 }) : t('learn.quiz.streakStart')}</p>
        <StreakDots dots={view.dots} />
        <Button variant="primary" size="xl" className="mt-1" onClick={onStart}>
          {t('learn.quiz.start')}
        </Button>
        <span className="text-center text-[13px] text-muted-foreground">{t('learn.quiz.time')}</span>
      </div>
    </div>
  )
}

/** Një pyetje: çipi, pyetja, përgjigjet (64 px); pas prekjes shpjegimi "Pse" me burimin dhe "Tjetra". */
function Question({ fact, chosen, onAnswer, onNext, busy, failed }: { fact: Fact; chosen: number | null; onAnswer: (index: number) => void; onNext: () => void; busy: boolean; failed: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const answered = chosen !== null
  const options = quizOptions(i18n, fact)
  const question = quizQuestion(i18n, fact)
  return (
    <>
      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-2">
        <TopicChip fact={fact} label={quizTopic(i18n, fact)} />
        <h1 className="m-0 font-display text-[36px] leading-[0.95] font-extrabold uppercase [overflow-wrap:anywhere]">{question}</h1>
        {answered ? <p className="sr-only">{t('learn.quiz.swipeHint')}</p> : null}
        <div role="group" aria-label={t('learn.quiz.answers')} className="mt-auto flex flex-col gap-2.5 pb-3.5">
          {options.map((option, position) => {
            const correct = position === fact.quiz.correct
            const picked = position === chosen
            const label = answered && correct ? t('learn.quiz.answerCorrect', { answer: option }) : answered && picked ? t('learn.quiz.answerWrong', { answer: option }) : option
            return (
              <button
                key={option}
                type="button"
                aria-label={label}
                aria-pressed={picked}
                disabled={answered}
                onClick={() => onAnswer(position)}
                className={cn(
                  'box-border flex min-h-16 w-full items-center gap-3 rounded-lg px-3.5 py-2 text-left text-[19px] leading-[1.25] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-default',
                  answered && correct ? 'border-2 border-foreground bg-surface' : 'border border-border bg-surface',
                  answered && !correct && 'text-muted-foreground',
                )}
              >
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-surface-2 font-display text-base font-bold">
                  {LETTERS[position]}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
                {answered && (correct || picked) ? (
                  <span aria-hidden className={cn('flex shrink-0 items-center gap-1 text-[13px] font-semibold', correct ? 'text-foreground' : 'text-muted-foreground')}>
                    <Icon name={correct ? 'zgjedhur' : 'mbyll-vrull'} size={16} />
                    {correct ? t('learn.quiz.correct') : t('learn.quiz.wrong')}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      {answered ? (
        <section aria-labelledby={`why-${fact.id}`} className="flex shrink-0 flex-col gap-2 rounded-t-[24px] border-t border-border bg-surface px-4 pt-5 pb-7">
          <h2 id={`why-${fact.id}`} className="type-label text-muted-foreground">
            {t('learn.quiz.why')}
          </h2>
          <p className="m-0 text-[17px] leading-[1.45] font-medium">{factText(i18n, fact)}</p>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('ui.fact.source', { source: `${factSource(i18n, fact)} · ${fact.source.title}` })}</span>
          {failed ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {t('learn.quiz.failed')}
            </p>
          ) : null}
          <Button variant="primary" size="xl" className="mt-2" disabled={busy} onClick={onNext}>
            {t('learn.quiz.next')}
          </Button>
        </section>
      ) : (
        <p className="shrink-0 px-4 pb-7 text-center text-[13px] text-muted-foreground">{t('learn.quiz.tapHint')}</p>
      )}
    </>
  )
}

/** Rezultati: "4/5", vargu me rrathët, arritja, "Ku gabove", "Mbaro" dhe lidhja te faqja Mëso. */
function Result({ view, facts, week, onFinish, onLearn }: { view: QuizView; facts: Fact[]; week: string; onFinish: () => void; onLearn: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const score = view.done?.score ?? 0
  const wrong = facts.flatMap((fact, index) => {
    const chosen = view.done?.answers[index]?.chosen
    return chosen !== undefined && chosen !== fact.quiz.correct ? [{ fact, chosen }] : []
  })
  const name = achievementName(i18n, 'quiz_4')
  const { achievement } = view
  const left = achievement.target - achievement.current
  return (
    <div className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-speed-lines mask-fade-down" />
      <div className="relative flex flex-1 flex-col gap-3 px-4 pt-1">
        <p className="m-0 font-display text-[120px] leading-[0.85] font-extrabold tabular-nums" aria-hidden>
          {t('learn.quiz.scoreBig', { score, total: QUIZ_SIZE })}
        </p>
        <h1 className="m-0 text-[15px] font-normal text-muted-foreground">{t('learn.quiz.scoreLine', { score, total: QUIZ_SIZE, week })}</h1>
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-xl font-bold">{t('learn.quiz.streak', { count: view.streak })}</h2>
          <StreakDots dots={view.dots} />
          <p className="m-0 text-[13px] text-muted-foreground">
            {achievement.earnedOn
              ? t('learn.quiz.earned', { name, date: fmt.date(atNoon(achievement.earnedOn), { weekday: false }) })
              : t('learn.quiz.toAchievement', { count: left, name })}
          </p>
        </div>
        <section aria-labelledby="quiz-mistakes" className="flex flex-col gap-2 pt-1">
          <h2 id="quiz-mistakes" className="type-label text-muted-foreground">
            {t('learn.quiz.mistakes')}
          </h2>
          {wrong.length === 0 ? <p className="m-0 text-[15px]">{t('learn.quiz.allRight')}</p> : null}
          {wrong.map(({ fact, chosen }) => (
            <Mistake key={fact.id} fact={fact} chosen={chosen} />
          ))}
        </section>
      </div>
      <div className="relative flex shrink-0 flex-col items-center gap-1 px-4 pt-3 pb-5">
        <Button variant="primary" size="xl" onClick={onFinish}>
          {t('learn.quiz.finish')}
        </Button>
        <Button variant="ghost" className="font-sans text-[15px] font-semibold tracking-normal normal-case underline underline-offset-[3px]" onClick={onLearn}>
          {t('learn.quiz.toLearn')}
        </Button>
      </div>
    </div>
  )
}

function Mistake({ fact, chosen }: { fact: Fact; chosen: number }): ReactNode {
  const i18n = useI18n()
  const { t } = i18n
  const options = quizOptions(i18n, fact)
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
      <h3 className="m-0 text-[17px] leading-[1.3] font-semibold">{quizQuestion(i18n, fact)}</h3>
      <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon name="mbyll-vrull" size={14} />
        {t('learn.quiz.chose', { answer: options[chosen] ?? '' })}
      </p>
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon name="zgjedhur" size={14} />
        {t('learn.quiz.right', { answer: options[fact.quiz.correct] })}
      </p>
      <p className="m-0 text-[15px] leading-[1.45]">{factText(i18n, fact)}</p>
      <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('ui.fact.source', { source: `${factSource(i18n, fact)} · ${fact.source.title}` })}</span>
    </article>
  )
}
