import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { type RefObject, useEffect, useRef } from 'react'

// Lëvizja e seancës (DESIGN.md › Lëvizja): hyrja "me vrull" e kartës së setit të ruajtur dhe
// shkëndija e rekordit te mbyllja, me Web Animations, që të respektojnë "lëvizjen e reduktuar" edhe
// jashtë CSS-së: atëherë vetëm zbehje 120 ms, pa kërcim e pa shkëndija që shpërthejnë.

const VRULL = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const canAnimate = (element: Element | null): element is Element => element !== null && typeof element.animate === 'function'

/** Hyrja e një karte: 280 ms me kërcim; me lëvizje të reduktuar vetëm zbehje 120 ms. */
export function useEntrance<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!canAnimate(element)) return
    if (reducedMotion()) element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 })
    else element.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 280, easing: VRULL })
  }, [])
  return ref
}

/**
 * Rekordi (DESIGN.md: shkëndija prushi 600 ms, një herë): shkëndijat dalin nga qendra, numri hyn me
 * kërcim. Me lëvizje të reduktuar të dyja vetëm zbehen në 120 ms.
 */
export function useRecordBurst<S extends Element, N extends Element>(): { sparks: RefObject<S | null>; number: RefObject<N | null> } {
  const sparks = useRef<S>(null)
  const number = useRef<N>(null)
  useEffect(() => {
    const reduced = reducedMotion()
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

/** Dridhja e shkurtër e rekordit në telefon; në shfletues asgjë. */
export async function recordPulse() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy })
  } catch {
    // Pa dridhje: ekrani e tregon rekordin gjithsesi.
  }
}
