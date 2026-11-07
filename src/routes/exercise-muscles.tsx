import { lazy, Suspense, useCallback, useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { FocusChip } from '@/components/body/focus-chip'
import { MUSCLE_ROLE, roleOf } from '@/components/body/roles'
import { Sheet } from '@/components/layout/sheet'
import { buttonVariants } from '@/components/ui/button-variants'
import { KEY_NAMES } from '@/body/muscle-info'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'

// Muskujt e një ushtrimi te modeli 3D (SPEC §11, funksioni 1; TH-19): kryesorët me brand, ndihmësit
// gri si te figura 2D, të tjerët pa ngjyrë. Modeli kthehet vetë nga kryesorët (p.sh. Romanian
// Deadlift mbrapa). Prekja e një muskuli, te modeli ose te lista, e fokuson dhe thotë rolin e tij.
// Hapet nga ekrani i ushtrimit dhe nga seanca.

const BodyModel = lazy(() => import('@/components/body/body-model'))


export interface ExerciseMuscles {
  name: string
  primary: string[]
  secondary: string[]
}

export function ExerciseMusclesSheet({ exercise, onClose }: { exercise: ExerciseMuscles; onClose: () => void }) {
  const { name, primary, secondary } = exercise
  const helpers = secondary.filter((key) => !primary.includes(key))
  // `request` rritet me çdo prekje, që e njëjta zgjedhje pas një rrotullimi ta afrojë përsëri kamerën.
  const [focus, setFocusState] = useState<{ key: string; request: number } | null>(null)
  const setFocus = (key: string | null) => setFocusState((current) => (key ? { key, request: (current?.request ?? 0) + 1 } : null))
  const [back, setBack] = useState(false)
  const label = `Muskujt e ${name}`
  const roleText = (key: string) => {
    const role = roleOf(key, primary, secondary)
    return role ? MUSCLE_ROLE[role].label : 'Nuk punon te ky ushtrim'
  }
  const paint = useCallback(
    (key: string) => {
      const role = roleOf(key, primary, secondary)
      return role ? MUSCLE_ROLE[role].tone : null
    },
    [primary, secondary],
  )

  return (
    <Sheet title={label} onClose={onClose}>
      <div className="flex flex-col gap-2 rounded-xl bg-panel p-2 text-panel-foreground">
        {webglAvailable() ? (
          <>
            <Suspense fallback={<div aria-hidden className="h-[320px]" />}>
              <BodyModel
                className="h-[320px]"
                paint={paint}
                face={primary}
                focus={focus ? [focus.key] : null}
                focusRequest={focus?.request}
                onPick={setFocus}
                back={back}
                onBackChange={setBack}
                label={label}
                overlay={focus ? <FocusChip title={KEY_NAMES[focus.key] ?? focus.key} detail={roleText(focus.key)} onClear={() => setFocus(null)} /> : null}
              />
            </Suspense>
            <button type="button" onClick={() => setBack(!back)} className={cn(buttonVariants({ variant: 'panel' }), 'self-center')}>
              {back ? 'Shiko përpara' : 'Shiko mbrapa'}
            </button>
          </>
        ) : (
          <BodyFigure primary={primary} secondary={secondary} label={label} scale={1.6} className="self-center py-2" />
        )}
        <ul aria-label="Legjenda" className="flex justify-center gap-x-4 pb-1 text-xs leading-4 text-panel-muted-foreground">
          {(['primary', 'secondary'] as const).map((role) => (
            <li key={role} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2.5 rounded-full', MUSCLE_ROLE[role].swatch)} />
              {MUSCLE_ROLE[role].label}
            </li>
          ))}
        </ul>
      </div>
      <MuscleList title="Kryesorë" keys={primary} focus={focus?.key ?? null} onFocus={setFocus} />
      <MuscleList title="Ndihmës" keys={helpers} focus={focus?.key ?? null} onFocus={setFocus} />
    </Sheet>
  )
}

function MuscleList({ title, keys, focus, onFocus }: { title: string; keys: string[]; focus: string | null; onFocus: (key: string) => void }) {
  if (keys.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-sm leading-5 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={focus === key}
            onClick={() => onFocus(key)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm font-semibold',
              focus === key ? 'border-foreground bg-selected text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {KEY_NAMES[key] ?? key}
          </button>
        ))}
      </div>
    </section>
  )
}
