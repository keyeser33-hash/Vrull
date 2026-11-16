import type { ExerciseRecord } from '@/data/training'
import { useExercisePhoto } from '@/lib/exercise-photo'
import { guideFor } from '@/program/exercise-guide-data'
import { SESSION_CUES } from './exercise-guide'

// Udhëzuesi i ushtrimit për seancën (SPEC §0.3g): a ka foto (lëvizja palohet) dhe 3 sinjalet e para.

/** Çfarë ka ushtrimi për seancën: foto (lëvizja palohet) dhe sinjalet. */
export function useSessionGuide(exercise: Pick<ExerciseRecord, 'libraryId' | 'name'> | undefined) {
  const photo = useExercisePhoto(exercise?.libraryId ?? null)
  const guide = exercise ? guideFor(exercise) : null
  return {
    guide,
    cues: guide?.cues.items.slice(0, SESSION_CUES) ?? [],
    hasMotion: Boolean(exercise?.libraryId) && photo.status !== 'missing',
  }
}
