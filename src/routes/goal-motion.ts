import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { store } from '@/data/app-data'

// Qëllimi i arritur (SPEC §0.3c, bordi "Lëvizja e 0.23"): segmenti mbushet (320 ms), pastaj një unazë
// shkëndije 600 ms me `ease-vrull` dhe një dridhje e mesme; një herë në javë për qëllim. Telefoni mban
// cilat qëllime u festuan këtë javë (`writeDevice`, pa sinkronizim). Me lëvizje të reduktuar unaza vetëm
// zbehet në 120 ms; dridhja mbetet. Asnjë festim nuk vonon një prekje: matësit janë gati që në fillim.

const KEY = 'goal-celebrated'
const VRULL = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Qëllimet që arritën këtë javë dhe s'janë festuar ende; i shënon si të festuara. */
export function useGoalCelebration(monday: string | null, met: readonly string[]): ReadonlySet<string> {
  const [celebrate, setCelebrate] = useState<ReadonlySet<string>>(new Set())
  const metKey = met.join(',')
  useEffect(() => {
    if (!monday || !metKey) return
    let cancelled = false
    void (async () => {
      const saved = (await store.readDevice(KEY)) as { monday?: unknown; keys?: unknown } | undefined
      const done = saved?.monday === monday && Array.isArray(saved.keys) ? saved.keys.map(String) : []
      const fresh = metKey.split(',').filter((key) => !done.includes(key))
      if (cancelled || fresh.length === 0) return
      await store.writeDevice(KEY, { monday, keys: [...done, ...fresh] })
      setCelebrate(new Set(fresh))
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [monday, metKey])
  return celebrate
}

/** Unaza e shkëndijës: pas mbushjes së segmentit (320 ms), 600 ms, një herë. */
export function useSpark<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof element.animate !== 'function') return
    if (reducedMotion()) element.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 320, fill: 'both' })
    else element.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 600, delay: 320, easing: VRULL, fill: 'both' })
  }, [])
  return ref
}
