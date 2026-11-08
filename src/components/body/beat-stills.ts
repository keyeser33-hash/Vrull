import { useEffect, useState } from 'react'
import type { Tone } from '@/body/model-math'
import { webglAvailable } from '@/lib/webgl'

// Imazhet e "Trupit në ritëm" (SPEC V29, V2-E1-12): pamja "e qetë" dhe "e ndezur" e trupit, me
// muskujt e stërvitjes së sotme në prush, të renderuara një herë me `renderBodyStills` (një kontekst
// WebGL, i liruar menjëherë). `BeatBody` (body-beat.tsx) i ndërron me CSS.

const CALM: Tone = { token: '--ember', alpha: 0.55 }
const LIT: Tone = { token: '--ember', alpha: 1 }

/** Pamja e madhe e ekranit "Trupi në ritëm"; mini-player-i përdor të njëjtat imazhe, të zmadhuara. */
export const BEAT_HERO_HEIGHT = 394
export const beatHeroWidth = () => Math.round(Math.min(typeof window === 'undefined' ? 390 : window.innerWidth, 480))

export interface BeatStills {
  calm: string
  lit: string
}

export interface BeatStillsRequest {
  /** Muskujt kryesorë të stërvitjes së sotme: ndizen në prush. */
  primary: string[]
  /** Muskujt ku shikon kamera (grupi kryesor). */
  focus: string[]
  back: boolean
  width: number
  height: number
}

// Imazhet e renderuara, sipas temës, muskujve dhe madhësisë: seanca, mini-player-i dhe ekrani i plotë
// i ndajnë. Mbahen pak; të vjetrat lirohen.
const KEEP = 4
const cache = new Map<string, Promise<BeatStills | null>>()

function remember(key: string, stills: Promise<BeatStills | null>) {
  cache.set(key, stills)
  while (cache.size > KEEP) {
    const [oldest, value] = cache.entries().next().value!
    cache.delete(oldest)
    void value.then((old) => {
      if (!old) return
      URL.revokeObjectURL(old.calm)
      URL.revokeObjectURL(old.lit)
    })
  }
}

/** Tema e tanishme (klasat e `<html>` dhe ngjyra e kartës), që një temë e re të renderohet sërish. */
const themeKey = () => `${document.documentElement.className}|${getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()}`

export function useBeatStills(request: BeatStillsRequest | null): BeatStills | null {
  const key = request ? [themeKey(), request.primary.join(','), request.focus.join(','), request.back ? 'back' : 'front', request.width, request.height].join('|') : null
  const [result, setResult] = useState<{ key: string; stills: BeatStills | null } | null>(null)
  useEffect(() => {
    if (!key || !request || request.primary.length === 0 || !webglAvailable()) return
    let cancelled = false
    let stills = cache.get(key)
    if (!stills) {
      const lit = new Set(request.primary)
      const paint = (tone: Tone) => (muscle: string) => (lit.has(muscle) ? tone : null)
      stills = import('./body-still')
        .then(({ renderBodyStills }) =>
          renderBodyStills(
            document.documentElement,
            [
              { paint: paint(CALM), back: request.back },
              { paint: paint(LIT), back: request.back },
            ],
            { width: request.width, height: request.height },
            { focus: request.focus, margin: 1.6 },
          ),
        )
        .then(([calm, beat]) => ({ calm: calm.url, lit: beat.url }))
        .catch(() => null)
      remember(key, stills)
    }
    void stills.then((value) => {
      if (!cancelled) setResult({ key, stills: value })
    })
    return () => {
      cancelled = true
    }
    // Kërkesa përcaktohet krejt nga çelësi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result && result.key === key ? result.stills : null
}
