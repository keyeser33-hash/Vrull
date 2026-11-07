import { lazy, Suspense, useCallback, useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { Sheet } from '@/components/layout/sheet'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import type { Tone } from '@/body/model-math'
import { KEY_NAMES } from '@/body/muscle-info'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'

// Muskujt e një ushtrimi te modeli 3D (SPEC §11, funksioni 1; TH-19): kryesorët me brand, ndihmësit
// gri si te figura 2D, të tjerët pa ngjyrë. Modeli kthehet vetë nga kryesorët (p.sh. Romanian
// Deadlift mbrapa). Prekja e një muskuli, te modeli ose te lista, e fokuson dhe thotë rolin e tij.
// Hapet nga ekrani i ushtrimit dhe nga seanca.

const BodyModel = lazy(() => import('@/components/body/body-model'))

const PRIMARY: Tone = { token: '--brand', alpha: 1 }
const SECONDARY: Tone = { token: '--panel-muted-foreground', alpha: 0.6 }

export interface ExerciseMuscles {
  name: string
  primary: string[]
  secondary: string[]
}

export function ExerciseMusclesSheet({ exercise, onClose }: { exercise: ExerciseMuscles; onClose: () => void }) {
  const { name, primary, secondary } = exercise
  const helpers = secondary.filter((key) => !primary.includes(key))
  const [focus, setFocus] = useState<string | null>(null)
  const [back, setBack] = useState(false)
  const label = `Muskujt e ${name}`
  const roleOf = (key: string) => (primary.includes(key) ? 'Kryesor' : helpers.includes(key) ? 'Ndihmës' : 'Nuk punon te ky ushtrim')
  const paint = useCallback((key: string) => (primary.includes(key) ? PRIMARY : secondary.includes(key) ? SECONDARY : null), [primary, secondary])

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
                focus={focus ? [focus] : null}
                onPick={setFocus}
                back={back}
                onBackChange={setBack}
                label={label}
                overlay={
                  focus ? (
                    <div
                      role="group"
                      aria-label="Muskuli i zgjedhur"
                      className="mb-1 flex max-w-[320px] items-center gap-1 rounded-2xl bg-panel-button/95 py-0.5 pr-0.5 pl-4 text-sm leading-5 shadow-md"
                    >
                      <span className="truncate">
                        <span className="font-semibold">{KEY_NAMES[focus] ?? focus}</span> · {roleOf(focus)}
                      </span>
                      <button type="button" aria-label="Hiq fokusin" onClick={() => setFocus(null)} className="flex size-11 shrink-0 items-center justify-center rounded-full">
                        <Icon name="mbyll" size={18} />
                      </button>
                    </div>
                  ) : null
                }
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
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-brand" />
            Kryesor
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-panel-muted-foreground opacity-60" />
            Ndihmës
          </li>
        </ul>
      </div>
      <MuscleList title="Kryesorë" keys={primary} focus={focus} onFocus={setFocus} />
      <MuscleList title="Ndihmës" keys={helpers} focus={focus} onFocus={setFocus} />
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
            className={cn(buttonVariants({ variant: focus === key ? 'default' : 'outline' }), 'px-4')}
          >
            {KEY_NAMES[key] ?? key}
          </button>
        ))}
      </div>
    </section>
  )
}
