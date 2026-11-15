import { useNavigate, useSearchParams } from 'react-router'
import { StoryRow, type StoryItem } from '@/components/ui/story-row'
import { store, useLocalQuery } from '@/data/app-data'
import { mentorNoteFor } from '@/data/mentor'
import { readinessView } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { useI18n } from '@/i18n/use-i18n'
import { mondayOf } from '@/progress/weekly-goals'
import { markStorySeen, readSeenStories, type Story, storyRing } from '@/today/stories'
import { MentorSheet } from './mentor-sheet'
import { SHEET, useOpenSheet } from './readiness-sheets'

// Rrathët e ditës te Sot (V57, SPEC §0.3f): "Si ndihesh?" deri sa dita të plotësohet, pastaj "Gati N%"; "Mentori" vetëm
// kur ka shënim këtë javë ose seancë (V55); të dielën "Java jote". Prekja hap rrjedhat që ekzistojnë dhe e shënon rrethin
// të shikuar për ditën (ruhet vetëm në telefon).

async function storiesData(date: string, monday: string, weekMonday: string | null) {
  const [rv, seen, note] = await Promise.all([readinessView(store, date), readSeenStories(store, date), mentorNoteFor(store, monday)])
  return { ring: storyRing({ checkedIn: !!rv.state, skipped: rv.skipped, percent: rv.readiness?.percent ?? null, mentor: note ? { id: note.id } : null, weekMonday, seen }), note }
}

export function TodayStories({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const open = useOpenSheet()
  const monday = mondayOf(view.date)
  const data = useLocalQuery(() => storiesData(view.date, monday, view.weekCard), [view.date, monday, view.weekCard])
  if (!data) return null
  const { ring, note } = data
  const seen = (story: Story) => void markStorySeen(store, view.date, story.key)

  const labelOf = (story: Story) =>
    story.kind === 'checkin'
      ? t('sot.story.checkin')
      : story.kind === 'ready'
        ? t('sot.story.ready', { percent: fmt.number(story.percent ?? 0) })
        : story.kind === 'week'
          ? t('sot.story.week')
          : note?.kind === 'plani_javes'
            ? t('sot.story.plan')
            : t('sot.story.mentor')
  const items: StoryItem[] = ring.map((story) => {
    const label = labelOf(story)
    return {
      key: story.key,
      label,
      spoken: story.seen ? label : t('sot.story.new', { label }),
      icon: story.kind === 'checkin' ? 'zemra' : story.kind === 'ready' ? 'pulsi' : story.kind === 'week' ? 'kalendari' : 'biseda',
      seen: story.seen,
      onSelect: () => {
        if (story.kind === 'checkin') return open('gjendja')
        seen(story)
        if (story.kind === 'ready') open('gati')
        else if (story.kind === 'week') navigate(`/progresi/java/${story.monday}`)
        else open('mentori')
      },
    }
  })
  return (
    <>
      <StoryRow items={items} label={t('sot.stories.label')} />
      {params.get(SHEET) === 'mentori' ? <MentorSheet monday={monday} onClose={() => navigate(-1)} /> : null}
    </>
  )
}
