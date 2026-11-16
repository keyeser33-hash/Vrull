import { useNavigate, useSearchParams } from 'react-router'
import { StoryRow, type StoryItem } from '@/components/ui/story-row'
import { store, useLocalQuery } from '@/data/app-data'
import { quizView, todayFact } from '@/data/learn'
import { mentorNoteFor } from '@/data/mentor'
import { readinessView } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { useI18n } from '@/i18n/use-i18n'
import { mondayOf } from '@/progress/weekly-goals'
import { markStorySeen, readSeenStories, type Story, storyRing } from '@/today/stories'
import { FactStory } from './fact-story'
import { QuizStories } from './quiz-stories'
import { MentorSheet } from './mentor-sheet'
import { SHEET, useOpenSheet } from './sheet-params'

// Rrathët e ditës te Sot (V57, SPEC §0.3f): "Si ndihesh?" deri sa dita të plotësohet, pastaj "Gati N%"; "Mentori" vetëm
// kur ka shënim këtë javë ose seancë (V55); të dielën "Java jote" dhe kuizi (§0.3e); "A e dije?" me faktin e ditës. Prekja
// hap rrjedhat që ekzistojnë dhe e shënon rrethin të shikuar për ditën (ruhet vetëm në telefon); "A e dije?" dhe kuizi
// e marrin nga `learn_events`. Kuizi lexohet vetëm në dritaren e tij (e diela 20:00 deri të hënën).

async function storiesData(view: TodayView, monday: string) {
  const [rv, seen, note, fact, quiz] = await Promise.all([
    readinessView(store, view.date),
    readSeenStories(store, view.date),
    mentorNoteFor(store, monday),
    todayFact(store, view),
    view.weekCard ? quizView(store) : null,
  ])
  const ring = storyRing({
    checkedIn: !!rv.state,
    skipped: rv.skipped,
    percent: rv.readiness?.percent ?? null,
    mentor: note ? { id: note.id } : null,
    weekMonday: view.weekCard,
    fact: fact ? { date: fact.date, seen: fact.seen } : null,
    quiz: quiz && quiz.facts ? { monday: quiz.monday, done: !!quiz.done } : null,
    seen,
  })
  return { ring, note, fact }
}

export function TodayStories({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const open = useOpenSheet()
  const monday = mondayOf(view.date)
  // Faktet e Sot ndjekin stërvitjen e ditës: mënyra dhe ushtrimet e saj.
  const exercises = view.snapshot?.plan.slots.map((slot) => slot.exerciseId).join() ?? ''
  const data = useLocalQuery(() => storiesData(view, monday), [view.date, monday, view.weekCard, view.mode, exercises])
  if (!data) return null
  const { ring, note, fact } = data
  const seen = (story: Story) => void markStorySeen(store, view.date, story.key)

  const labelOf = (story: Story) =>
    story.kind === 'checkin'
      ? t('sot.story.checkin')
      : story.kind === 'ready'
        ? t('sot.story.ready', { percent: fmt.number(story.percent ?? 0) })
        : story.kind === 'week'
          ? t('sot.story.week')
          : story.kind === 'quiz'
            ? t('learn.ring.quiz')
            : story.kind === 'fact'
              ? t('learn.ring.fact')
              : note?.kind === 'plani_javes'
            ? t('sot.story.plan')
            : t('sot.story.mentor')
  const items: StoryItem[] = ring.map((story) => {
    const label = labelOf(story)
    return {
      key: story.key,
      label,
      spoken: story.seen ? label : t('sot.story.new', { label }),
      icon: story.kind === 'checkin' ? 'zemra' : story.kind === 'ready' ? 'pulsi' : story.kind === 'week' ? 'kalendari' : story.kind === 'quiz' ? 'pyetje' : story.kind === 'fact' ? 'llamba' : 'biseda',
      seen: story.seen,
      onSelect: () => {
        // "Si ndihesh?" dhe "Gati N%" hapin shikuesin; shënohen të shikuara kur ai mbyllet (readiness-sheets.tsx).
        if (story.kind === 'checkin') return open('gjendja')
        if (story.kind === 'ready') return open('gati')
        // "A e dije?" shënohet i parë kur hapet; kuizi kur mbyllet (`learn_events`).
        if (story.kind === 'fact') return open('fakti')
        if (story.kind === 'quiz') return open('kuizi')
        seen(story)
        if (story.kind === 'week') navigate(`/progresi/java/${story.monday}`)
        else open('mentori')
      },
    }
  })
  return (
    <>
      <StoryRow items={items} label={t('sot.stories.label')} />
      {params.get(SHEET) === 'mentori' ? <MentorSheet monday={monday} onClose={() => navigate(-1)} /> : null}
      {params.get(SHEET) === 'fakti' && fact ? <FactStory entry={fact} onClose={() => navigate(-1)} /> : null}
      {params.get(SHEET) === 'kuizi' ? <QuizStories onClose={() => navigate(-1)} onLearn={() => navigate('/progresi/meso', { replace: true })} /> : null}
    </>
  )
}
