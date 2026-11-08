import { type CSSProperties, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { beatPhaseMs, type Pulse } from '@/lib/music-pulse'
import type { BeatStills } from './beat-stills'

// "Trupi në ritëm" (SPEC V29, V2-E1-12): muskujt e stërvitjes së sotme në prush, që pulsojnë me
// tempon e këngës. Dy pamjet (beat-stills.ts) ndërrohen me CSS: pamja e ndezur shuhet brenda një
// goditjeje (`animate-beat`, globals.css). Pa WebGL në çdo goditje; animacioni ndalet
// (`animation-play-state`) kur app-i del në sfond; me "lëvizje të reduktuar" trupi rri i ndezur.

/** Vetitë CSS të pulsit: periudha, faza (`--beat-phase`, e vendosur nga `BeatBody`) dhe ndalja. */
function beatStyle(pulse: Pulse, ring = 0): CSSProperties {
  return {
    ['--beat' as string]: pulse.periodMs ? `${Math.round(pulse.periodMs)}ms` : undefined,
    // Unazat dalin një çdo goditje: secila nis një goditje më herët.
    animationDelay: ring ? `calc(var(--beat-phase, 0ms) - var(--beat) * ${ring})` : 'var(--beat-phase, 0ms)',
    animationPlayState: pulse.running ? 'running' : 'paused',
  }
}

/**
 * Trupi që pulson: pamja e qetë poshtë, pamja e ndezur sipër (shuhet në çdo goditje). `scale` e zmadhon
 * rreth qendrës (mini-player-i). `anchor` (koha e `performance.now()` e prekjes së fundit te "Prek
 * ritmin") e nis goditjen bashkë me muzikën; pa të, pulsi ndjek vetëm tempon. Pa imazhe (pa WebGL),
 * mbetet vetëm aura dhe unazat.
 */
export function BeatBody({
  stills,
  pulse,
  anchor = null,
  scale = 1,
  aura = false,
  rings = 0,
  ringClassName,
  className,
}: {
  stills: BeatStills | null
  pulse: Pulse
  anchor?: number | null
  scale?: number
  aura?: boolean
  /** Sa unaza dalin nga muskujt (0–3), një çdo goditje. */
  rings?: number
  ringClassName?: string
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  // Faza llogaritet pas vizatimit, kur nis animacioni: vonesa negative e vendos në goditjen e saktë.
  useEffect(() => {
    const phase = pulse.periodMs && anchor !== null ? beatPhaseMs(pulse.periodMs, anchor, performance.now()) : 0
    root.current?.style.setProperty('--beat-phase', `${-Math.round(phase)}ms`)
  }, [anchor, pulse.periodMs])
  const style = beatStyle(pulse)
  const image = 'absolute inset-0 size-full max-w-none object-cover'
  return (
    <div ref={root} aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {aura ? (
        <div
          className={cn('absolute -inset-x-1/4 inset-y-0 bg-radial-[closest-side] from-ember/18 via-ember/8 to-transparent', pulse.animate ? 'animate-beat-aura' : 'opacity-70')}
          style={style}
        />
      ) : null}
      {stills ? (
        <div className="absolute inset-0" style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}>
          <img alt="" src={stills.calm} className={image} />
          <img alt="" src={stills.lit} className={cn(image, pulse.animate ? 'animate-beat' : 'opacity-100')} style={style} />
        </div>
      ) : null}
      {Array.from({ length: rings }, (_, index) => (
        <span
          key={index}
          className={cn(
            'absolute top-1/2 left-1/2 aspect-square -translate-1/2 rounded-pill border-[1.5px] border-ember-text',
            pulse.animate ? 'animate-beat-ring opacity-0' : ['scale-90 opacity-50', 'scale-[1.18] opacity-30', 'scale-[1.46] opacity-15'][index],
            ringClassName,
          )}
          style={pulse.animate ? beatStyle(pulse, index) : undefined}
        />
      ))}
    </div>
  )
}
