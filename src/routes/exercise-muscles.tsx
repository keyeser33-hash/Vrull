import { lazy, Suspense, useCallback, useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { FocusChip } from '@/components/body/focus-chip'
import { MUSCLE_ROLE, type MuscleRole, roleOf } from '@/components/body/roles'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'

// Muskujt e një ushtrimi te modeli 3D (SPEC §11, funksioni 1; TH-19), në Vrull (V2-E1-10): kryesorët
// me prush, ndihmësit gri si te figura 2D, të tjerët pa ngjyrë. Modeli kthehet vetë nga kryesorët
// (p.sh. Romanian Deadlift mbrapa). Prekja e një muskuli, te modeli ose te lista, e fokuson dhe thotë
// rolin e tij. Hapet nga ekrani i ushtrimit dhe nga seanca. Emrat e çelësave: `bodyModel.key.*`.

const BodyModel = lazy(() => import('@/components/body/body-model'))

export interface ExerciseMuscles {
  name: string
  primary: string[]
  secondary: string[]
}

export function ExerciseMusclesSheet({ exercise, onClose }: { exercise: ExerciseMuscles; onClose: () => void }) {
  const { t } = useI18n()
  const { name, primary, secondary } = exercise
  const helpers = secondary.filter((key) => !primary.includes(key))
  // `request` rritet me çdo prekje, që e njëjta zgjedhje pas një rrotullimi ta afrojë përsëri kamerën.
  const [focus, setFocusState] = useState<{ key: string; request: number } | null>(null)
  const setFocus = (key: string | null) => setFocusState((current) => (key ? { key, request: (current?.request ?? 0) + 1 } : null))
  const [back, setBack] = useState(false)
  const label = t('builder.muscles.title', { name })
  const keyName = (key: string) => t(`bodyModel.key.${key}` as 'bodyModel.key.trapezius')
  const roleName = (role: MuscleRole) => t(role === 'primary' ? 'builder.muscles.rolePrimary' : 'builder.muscles.roleSecondary')
  const roleText = (key: string) => {
    const role = roleOf(key, primary, secondary)
    return role ? roleName(role) : t('builder.muscles.notUsed')
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
      <div className="flex flex-col gap-2">
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
                overlay={focus ? <FocusChip title={keyName(focus.key)} detail={roleText(focus.key)} onClear={() => setFocus(null)} /> : null}
              />
            </Suspense>
            <Button variant="secondary" className="self-center" onClick={() => setBack(!back)}>
              {back ? t('bodyModel.turn.front') : t('bodyModel.turn.back')}
            </Button>
          </>
        ) : (
          <BodyFigure primary={primary} secondary={secondary} label={label} scale={1.6} className="self-center py-2" />
        )}
        <ul aria-label={t('bodyModel.legend')} className="flex justify-center gap-x-4 pb-1 type-caption text-muted-foreground">
          {(['primary', 'secondary'] as const).map((role) => (
            <li key={role} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2.5 rounded-pill', MUSCLE_ROLE[role].swatch)} />
              {roleName(role)}
            </li>
          ))}
        </ul>
      </div>
      <MuscleList title={t('builder.muscles.primary')} keys={primary} name={keyName} focus={focus?.key ?? null} onFocus={setFocus} />
      <MuscleList title={t('builder.muscles.secondary')} keys={helpers} name={keyName} focus={focus?.key ?? null} onFocus={setFocus} />
    </Sheet>
  )
}

function MuscleList({ title, keys, name, focus, onFocus }: { title: string; keys: string[]; name: (key: string) => string; focus: string | null; onFocus: (key: string) => void }) {
  if (keys.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="type-label text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={focus === key}
            onClick={() => onFocus(key)}
            className={cn(
              'flex h-touch items-center rounded-pill border px-3.5 text-[15px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
              focus === key ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-surface-2 font-medium text-foreground',
            )}
          >
            {name(key)}
          </button>
        ))}
      </div>
    </section>
  )
}
