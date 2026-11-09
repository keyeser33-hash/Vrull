import { useNavigate, useSearchParams } from 'react-router'
import { ProgressHeader } from '@/components/layout/progress-tabs'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { type Achievement, achievementsView, type AchievementsView } from '@/data/achievements'
import { store, useLocalQuery } from '@/data/app-data'
import { trainingSnapshot } from '@/data/training'
import { programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { nearestAchievement } from '@/progress/achievements'
import { achievementName, achievementRule, achievementSheetStatus, achievementStatus } from './achievement-format'
import { AchievementBadge } from './achievement-parts'

// Progresi › Arritjet (V43, V44; bordi "Progresi · Arritjet"): kreu i Progresit me tab-et, "N nga 10 të
// fituara" dhe dhjetë pllakat në dy kolona: shenja, emri, rregulli me gjendjen dhe shiriti i progresit për
// të pafituarat. Prekja hap fletën (?arritja=<çelësi>, bordi "Arritjet · detaji"): si fitohet, data ose
// sa mungon, javët e vargut dhe "Më afër tani". Hapja e faqes jep arritjet që mungojnë (`achievementsView`).

const SHEET_PARAM = 'arritja'

export function AchievementsPage() {
  const { t } = useI18n()
  const view = useLocalQuery(() => achievementsView(store), [])
  const snapshot = useLocalQuery(() => trainingSnapshot(store), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const openKey = params.get(SHEET_PARAM)
  const open = view?.achievements.find((entry) => entry.key === openKey)
  const label = snapshot && !snapshot.completed ? programWeekLabel(t, snapshot.plan) : undefined
  return (
    <div className="flex flex-col gap-3.5">
      <ProgressHeader active="achievements" label={label} />
      {view ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex items-baseline gap-1">
              <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">{view.earned}</span>
              <span className="text-sm text-muted-foreground">{t('achievements.ofTotal', { total: view.total })}</span>
            </p>
            <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('achievements.once')}</span>
          </div>
          <ul aria-label={t('achievements.listLabel')} className="grid grid-cols-2 gap-2">
            {view.achievements.map((achievement) => (
              <li key={achievement.key} className="flex">
                <AchievementTile achievement={achievement} view={view} onOpen={() => setParams((current) => (current.set(SHEET_PARAM, achievement.key), current))} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div aria-hidden className="h-80 rounded-xl bg-surface" />
      )}
      {open && view ? <AchievementSheet achievement={open} view={view} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function AchievementTile({ achievement, view, onOpen }: { achievement: Achievement; view: AchievementsView; onOpen: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const earned = achievement.earnedOn !== null
  const status = achievementStatus(i18n, achievement, view.today)
  const rule = achievementRule(i18n, achievement, view.programmeName)
  const { current, target } = achievement.progress
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-[120px] w-full flex-col gap-1.5 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        earned ? (achievement.isNew ? 'border border-insight-border bg-surface' : surfaceClass) : 'border border-border bg-background',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <AchievementBadge achievement={achievement} size="tile" />
        {achievement.isNew ? <span className="text-xs font-semibold text-ember-text">{t('achievements.new')}</span> : null}
      </span>
      <span className="text-[15px] leading-[1.2] font-semibold">{achievementName(i18n, achievement.key)}</span>
      <span className="text-xs leading-[1.35] text-muted-foreground tabular-nums">{status ? `${rule} · ${status}` : rule}</span>
      {!earned && target > 0 ? <ProgressTrack ratio={current / target} ground="page" className="mt-auto h-1" /> : null}
    </button>
  )
}

function AchievementSheet({ achievement, view, onClose }: { achievement: Achievement; view: AchievementsView; onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const earned = achievement.earnedOn !== null
  const nearest = nearestAchievement(view.achievements, [achievement.key])
  const { current, target } = achievement.progress
  return (
    <Sheet
      title={achievementName(i18n, achievement.key)}
      description={achievementSheetStatus(i18n, achievement, view.today)}
      hero={<AchievementBadge achievement={achievement} size="hero" filled />}
      onClose={onClose}
      footer={
        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          {t('achievements.sheet.close')}
        </Button>
      }
    >
      {!earned && target > 0 ? <ProgressTrack ratio={current / target} className="shrink-0" /> : null}
      <section aria-labelledby="achievement-how" className="flex shrink-0 flex-col gap-2.5 border-t border-border pt-3.5">
        <h3 id="achievement-how" className="type-label text-muted-foreground">
          {t('achievements.sheet.how')}
        </h3>
        <p className="type-body">{t(`achievements.${achievement.key}.how`)}</p>
        {achievement.key === 'streak_4' ? <StreakWeeks achievement={achievement} /> : null}
      </section>
      {nearest ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3 type-caption">
          <span className="text-muted-foreground">{t('achievements.sheet.nearest')}</span>
          <span className="text-right tabular-nums">
            {achievementName(i18n, nearest.key)} · {t('achievements.progress', { current: nearest.progress.current, target: nearest.progress.target })}
          </span>
        </div>
      ) : null}
    </Sheet>
  )
}

const WEEK_DONE = 'bg-ember text-on-ember'
const WEEK_SPARE = 'border border-dashed border-ember-text'
const WEEK_OPEN = 'border border-dashed border-subtle text-muted-foreground'

/** Javët e vargut: të arriturat me prush, ajo me ditën rezervë me vijë ("3+1"), ato që mungojnë bosh. */
function StreakWeeks({ achievement }: { achievement: Achievement }) {
  const { t, fmt } = useI18n()
  const cells = Array.from({ length: achievement.progress.target }, (_, index) => achievement.weeks[index] ?? null)
  return (
    <ol aria-label={t('achievements.sheet.weeks')} className="grid grid-cols-4 gap-1.5">
      {cells.map((week, index) => {
        const number = index + 1
        const spoken = !week
          ? t('achievements.sheet.weekOpen', { week: number })
          : t(week.spare ? 'achievements.sheet.weekSpare' : 'achievements.sheet.week', { week: number, done: week.done, target: week.target })
        return (
          <li
            key={number}
            aria-label={spoken}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-0.5 rounded-md',
              !week ? WEEK_OPEN : week.spare ? WEEK_SPARE : WEEK_DONE,
            )}
          >
            <span aria-hidden className="text-xs font-semibold">
              {t('plan.week', { week: number })}
            </span>
            <span aria-hidden className="font-display text-lg leading-none font-extrabold tabular-nums">
              {!week ? '–' : week.spare ? `${fmt.number(week.done)}+1` : `${fmt.number(week.done)}/${fmt.number(week.target)}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
