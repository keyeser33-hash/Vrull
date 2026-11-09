import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { isTiredDay, TIRED_MOTION } from '@/lib/day-mode'

// Lëvizja e seancës (DESIGN.md › Lëvizja): banderola e rekordit mbi pushimin dhe shkëndija e rekordit
// te mbyllja, me Web Animations, që të respektojnë "lëvizjen e reduktuar" edhe jashtë CSS-së: atëherë
// vetëm zbehje 120 ms, pa kërcim, rrëshqitje ose shkëndija.

const VRULL = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const canAnimate = (element: Element | null): element is Element => element !== null && typeof element.animate === 'function'

/**
 * Rekordi (DESIGN.md: shkëndija prushi 600 ms, një herë): shkëndijat dalin nga qendra, numri hyn me
 * kërcim. Me lëvizje të reduktuar të dyja vetëm zbehen në 120 ms.
 */
export function useRecordBurst<S extends Element, N extends Element>(): { sparks: RefObject<S | null>; number: RefObject<N | null> } {
  const sparks = useRef<S>(null)
  const number = useRef<N>(null)
  useEffect(() => {
    const reduced = reducedMotion()
    // Ditë e lodhur (V50): pa shkëndija dhe pa kërcim; numri hyn me zbehje 360 ms, ease-out.
    if (isTiredDay()) {
      if (canAnimate(number.current) && !reduced) number.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TIRED_MOTION.ms, easing: TIRED_MOTION.easing })
      return
    }
    if (canAnimate(sparks.current)) {
      sparks.current.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: 'scale(1)' }],
        { duration: reduced ? 120 : 600, easing: reduced ? 'linear' : 'ease-out' },
      )
    }
    if (canAnimate(number.current)) {
      number.current.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: reduced ? 120 : 320, easing: reduced ? 'linear' : VRULL },
      )
    }
  }, [])
  return { sparks, number }
}

/** Banderola e rekordit (SPEC §0.3c, bordi "Lëvizja"): zbret në 250 ms dhe rri 3 s; zbehja e reduktuar 120 ms. */
export const BANNER = { slideMs: 250, stayMs: 3000, fadeMs: 120 } as const

/**
 * Lëvizja e banderolës së rekordit: zbret nga lart (250 ms, ease-out), rri 3 s dhe ngjitet përsëri;
 * me lëvizje të reduktuar vetëm shfaqet dhe zbehet (120 ms), pa rrëshqitje. `dismiss` e mbyll para
 * kohe ("Mbyll"); `onDone` thirret një herë, kur banderola ka ikur. Pa Web Animations mbyllet menjëherë.
 */
export function useBannerMotion<T extends HTMLElement>(onDone: () => void): { ref: RefObject<T | null>; dismiss: () => void } {
  const ref = useRef<T>(null)
  const done = useRef(onDone)
  const closing = useRef(false)
  useEffect(() => {
    done.current = onDone
  })
  const dismiss = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const element = ref.current
    if (!canAnimate(element)) {
      done.current()
      return
    }
    const reduced = reducedMotion()
    const exit = element.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'translateY(0)' }, { transform: 'translateY(-120%)' }], {
      duration: reduced ? BANNER.fadeMs : BANNER.slideMs,
      easing: reduced ? 'linear' : 'ease-in',
      fill: 'forwards',
    })
    exit.onfinish = () => done.current()
    exit.oncancel = () => done.current()
  }, [])
  useEffect(() => {
    const element = ref.current
    const reduced = reducedMotion()
    if (canAnimate(element)) {
      element.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(-120%)' }, { transform: 'translateY(0)' }], {
        duration: reduced ? BANNER.fadeMs : BANNER.slideMs,
        easing: reduced ? 'linear' : 'ease-out',
      })
    }
    const id = window.setTimeout(dismiss, (reduced ? BANNER.fadeMs : BANNER.slideMs) + BANNER.stayMs)
    return () => window.clearTimeout(id)
  }, [dismiss])
  return { ref, dismiss }
}

async function pulse(style: ImpactStyle) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style })
  } catch {
    // Pa dridhje: ekrani e tregon setin ose rekordin gjithsesi.
  }
}

/** Dridhja e lehtë e çdo "Ruaj setin" në telefon (SPEC §0.3c); kur seti jep rekord, vetëm `recordPulse`. */
export function savePulse() {
  return pulse(ImpactStyle.Light)
}

/** Dridhja e rëndë e rekordit në telefon; në shfletues asgjë. */
export function recordPulse() {
  // Ditë e lodhur (V50): pa festim, ndaj jo dridhja e rëndë, por seti jep dridhjen e lehtë si çdo "Ruaj setin".
  if (isTiredDay()) return savePulse()
  return pulse(ImpactStyle.Heavy)
}
