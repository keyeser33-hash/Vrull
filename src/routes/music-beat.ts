import { useMemo, useState } from 'react'
import { BEAT_HERO_HEIGHT, type BeatStills, type BeatStillsRequest, beatHeroWidth, useBeatStills } from '@/components/body/beat-stills'
import { facesBack } from '@/body/model-focus'
import { mainGroup } from '@/data/today'
import { muscleName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { type ControlResult, isPlaying, music, type MusicAction, type NowPlaying } from '@/lib/music'
import { type CurrentTempo, type MusicStatus, useNowPlaying, usePageActive, useReducedMotion, useSongTempo } from '@/lib/music-hooks'
import { type BeatPhase, type Pulse, pulse as pulseOf } from '@/lib/music-pulse'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { PlannedSlot } from '@/program/types'

// Muzika e seancës ("Trupi në ritëm", SPEC V29, V2-E1-12): një hook për gjithë ekranin e seancës, që
// ikona te kreu, ekrani i plotë, lidhja dhe "Prek ritmin" (music.tsx) ndajnë sesionin, tempon, pulsin
// dhe imazhet e trupit. Faza (seti ose pushimi) vjen nga seanca.

export interface SessionBeat {
  status: MusicStatus
  session: NowPlaying | null
  tempo: CurrentTempo
  phase: BeatPhase
  pulse: Pulse
  stills: BeatStills | null
  /** Kërkesa e imazheve të trupit, edhe pa leje (ilustrimi i ekranit të lidhjes). */
  stillsRequest: BeatStillsRequest | null
  back: boolean
  setBack(back: boolean): void
  /** "Gjoksi · tricepsi · pulpat". */
  muscles: string
  /** Veprimi i fundit i refuzuar nga app-i i muzikës, për mesazhin. */
  refusal: ControlResult | null
  act(action: MusicAction, options?: { positionMs?: number; queueItemId?: number }): Promise<void>
}

/** Muzika e seancës: sesioni, tempo, pulsi dhe imazhet e trupit, një herë për gjithë ekranin. */
export function useSessionBeat({
  slots,
  exercises,
  phase,
}: {
  slots: PlannedSlot[]
  exercises: Record<string, { primary: string[] } | undefined>
  phase: BeatPhase
}): SessionBeat {
  const { t, lang } = useI18n()
  const { status, session } = useNowPlaying(true)
  const tempo = useSongTempo(session)
  const active = usePageActive()
  const reducedMotion = useReducedMotion()
  const [refusal, setRefusal] = useState<ControlResult | null>(null)
  const primaryKey = [...new Set(slots.flatMap((slot) => exercises[slot.exerciseId]?.primary ?? []))].join(',')
  const focus = mainGroup(slots, exercises)?.keys ?? []
  const [back, setBack] = useState<boolean | null>(null)
  const facing = back ?? facesBack(focus)
  const connected = status === 'listening'
  const stillsRequest = primaryKey ? { primary: primaryKey.split(','), focus, back: facing, width: beatHeroWidth(), height: BEAT_HERO_HEIGHT } : null
  // Imazhet renderohen vetëm kur muzika është e lidhur; pa leje, vetëm kur hapet ekrani i lidhjes.
  const stills = useBeatStills(connected ? stillsRequest : null)
  const bpm = tempo.tempo?.bpm ?? null
  const pulse = pulseOf({ bpm, phase, playing: session ? isPlaying(session) : false, active, reducedMotion })
  const muscles = useMemo(() => {
    const primary = primaryKey.split(',')
    const names = MUSCLE_GROUPS.filter((group) => group.keys.some((key) => primary.includes(key))).map((group) => muscleName(t, group.id))
    return names.map((name, index) => (index === 0 ? name : name.toLocaleLowerCase(lang))).join(' · ')
  }, [primaryKey, t, lang])
  return {
    status,
    session,
    tempo,
    phase,
    pulse,
    stills,
    stillsRequest,
    back: facing,
    setBack,
    muscles,
    refusal,
    async act(action, options) {
      const result = await music.control(action, options)
      setRefusal(result === 'ok' ? null : result)
    },
  }
}
