import { ExerciseMotion } from '@/components/ui/exercise-motion'
import { WatchVideoButton } from '@/components/ui/exercise-video'
import type { ExerciseRecord } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { chosenVideo } from '@/program/exercise-videos'
import { tempoOf } from '@/program/motion'
import { useSessionGuide } from './session-guide-hook'

// Lëvizja dhe sinjalet te seanca (SPEC §0.3g, V58; bordet "Seanca · seti 1" dhe "Pushimi · ushtrimi i
// ri"): dy fotot e ushtrimit sipas tempos (`ExerciseMotion`, e palosshme), "Shiko videon" kur ka video, dhe
// 3 sinjalet e para të udhëzuesit. Ushtrimi pa foto ka vetëm sinjalet; pa udhëzues dhe pa foto asgjë.

/** Sinjalet me numër, të ngjeshura (kolona djathtas e fotos, ose karta e ushtrimit të ri). */
export function SessionCues({ cues, className }: { cues: { sq: string; en: string }[]; className?: string }) {
  const { t, lang } = useI18n()
  if (cues.length === 0) return null
  return (
    <ol aria-label={t('session.guide.cues')} className={cn('flex flex-col gap-2', className)}>
      {cues.map((cue, index) => (
        <li key={cue.sq} className="flex gap-2 text-sm leading-[1.3] font-medium">
          <span aria-hidden className="w-3 shrink-0 font-display font-bold text-ember-text tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0">{cue[lang]}</span>
        </li>
      ))}
    </ol>
  )
}

export function SessionGuide({
  exercise,
  folded,
  onFold,
  onVideo,
}: {
  exercise: ExerciseRecord
  folded: boolean
  onFold: (folded: boolean) => void
  /** "Shiko videon": hap videon e zgjedhur brenda app-it. */
  onVideo: () => void
}) {
  const { guide, cues, hasMotion } = useSessionGuide(exercise)
  const chosen = chosenVideo(exercise, exercise.videoUrl)
  if (!hasMotion) return cues.length ? <SessionCues cues={cues} /> : null
  return (
    <ExerciseMotion
      libraryId={exercise.libraryId}
      name={exercise.name}
      tempo={tempoOf(guide?.tempo)}
      showTempo={!guide || guide.tempo !== null}
      foldable
      folded={folded}
      onFoldedChange={onFold}
      layout="side"
      aside={<SessionCues cues={cues} />}
      action={chosen ? <WatchVideoButton chosen={chosen} onOpen={onVideo} className="min-h-12 px-2.5" /> : null}
      stageClassName="aspect-[4/3] rounded-lg"
    />
  )
}
