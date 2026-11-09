import { type ReactNode, useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { aiMonth } from '@/data/ai-usage'
import { store, supplementLabelRemote, useLocalQuery } from '@/data/app-data'
import { type LabelFields, type LabelResult } from '@/data/supplement-label'
import { removeSupplement, saveSupplement, type Supplement, supplementList } from '@/data/supplements'
import type { I18n } from '@/i18n'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { compressPhoto } from '@/lib/image'
import type { MealKey } from '@/nutrition/meals'
import type { DoseUnit, SupplementKind } from '@/nutrition/supplements'
import { ChoiceChip, EditorFooter, Switch } from './builder-parts'
import { parseGrams } from './nutrition-format'

// Ushqimi › Suplementet › Shto suplement (V39, V2-E2-10; bordet "Shto suplement" dhe "Nga etiketa"):
// emri, lloji, doza, gramët e lugës, kur merret, makrot për lugë dhe "Numëroje te ushqimi". "Fotografo
// etiketën" e dërgon foton (e zvogëluar) te AI-ja, që plotëson fushat; përdoruesi i kontrollon para
// "Vazhdo". Pa internet, fleta plotësohet me dorë. Me `:id` ndryshon ose heq një suplement të vetin.

const KINDS: readonly SupplementKind[] = ['protein', 'creatine', 'capsule', 'other']
const UNITS: readonly DoseUnit[] = ['scoop', 'g', 'mg', 'capsule', 'tablet', 'dose']
const MAIN_MEALS: readonly MealKey[] = ['breakfast_1', 'pre_workout', 'post_workout', 'bedtime']
const OTHER_MEALS: readonly MealKey[] = ['breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner']
/** Foto për AI-në: ana më e gjatë 1 568 px, si rekomandon Claude për leximin e tekstit. */
const LABEL_MAX_PX = 1568

interface Draft {
  name: string
  kind: SupplementKind
  doseAmount: string
  doseUnit: DoseUnit
  scoopG: string
  timing: MealKey[]
  kcal: string
  protein: string
  carbs: string
  fat: string
  countsAsFood: boolean
}

const DEFAULTS: Record<SupplementKind, Pick<Draft, 'doseAmount' | 'doseUnit' | 'countsAsFood'>> = {
  protein: { doseAmount: '1', doseUnit: 'scoop', countsAsFood: true },
  creatine: { doseAmount: '5', doseUnit: 'g', countsAsFood: false },
  capsule: { doseAmount: '1', doseUnit: 'capsule', countsAsFood: false },
  other: { doseAmount: '1', doseUnit: 'dose', countsAsFood: false },
}

const EMPTY: Draft = { name: '', kind: 'protein', scoopG: '', timing: [], kcal: '', protein: '', carbs: '', fat: '', ...DEFAULTS.protein }

const text = (value: number | null | undefined, fmt: I18n['fmt']) => (value === null || value === undefined ? '' : fmt.number(value, { maxDigits: 1 }))

function fromSupplement(supplement: Supplement, fmt: I18n['fmt']): Draft {
  return {
    name: supplement.name,
    kind: supplement.kind ?? 'other',
    doseAmount: text(supplement.doseAmount, fmt),
    doseUnit: supplement.doseUnit,
    scoopG: text(supplement.scoopG, fmt),
    timing: supplement.timing,
    kcal: text(supplement.macros?.kcal, fmt),
    protein: text(supplement.macros?.proteinG, fmt),
    carbs: text(supplement.macros?.carbsG, fmt),
    fat: text(supplement.macros?.fatG, fmt),
    countsAsFood: supplement.countsAsFood,
  }
}

/** Fushat e etiketës mbi draftin: ato që AI-ja nuk i lexoi mbeten siç ishin. */
function withLabel(draft: Draft, fields: LabelFields, fmt: I18n['fmt']): Draft {
  const kind = fields.kind ?? draft.kind
  const keep = (value: number | null, current: string) => (value === null ? current : text(value, fmt))
  return {
    ...draft,
    ...(fields.kind && fields.kind !== draft.kind ? DEFAULTS[kind] : {}),
    name: fields.name ?? draft.name,
    kind,
    doseAmount: keep(fields.doseAmount, fields.kind && fields.kind !== draft.kind ? DEFAULTS[kind].doseAmount : draft.doseAmount),
    doseUnit: fields.doseUnit ?? (fields.kind && fields.kind !== draft.kind ? DEFAULTS[kind].doseUnit : draft.doseUnit),
    scoopG: keep(fields.scoopG, draft.scoopG),
    kcal: keep(fields.kcal, draft.kcal),
    protein: keep(fields.proteinG, draft.protein),
    carbs: keep(fields.carbsG, draft.carbs),
    fat: keep(fields.fatG, draft.fat),
  }
}

export function SupplementEditorPage() {
  const { id } = useParams()
  const list = useLocalQuery(() => supplementList(store), [])
  const { t, fmt } = useI18n()
  const title = t(id ? 'food.supplement.edit' : 'food.supplement.add')
  if (!list) {
    return (
      <div className="flex flex-col gap-5">
        <BackHeader title={title} back={t('food.supplements')} fallback="/ushqimi" />
        <div aria-hidden className="h-96 rounded-xl bg-surface" />
      </div>
    )
  }
  const existing = id ? list.find((item) => item.id === id && item.custom) : undefined
  if (id && !existing) {
    return (
      <div className="flex flex-col gap-5">
        <BackHeader title={title} back={t('food.supplements')} fallback="/ushqimi" />
        <p className="type-body text-muted-foreground">{t('food.noSupplements')}</p>
      </div>
    )
  }
  return <SupplementEditor key={id ?? 'new'} id={id} initial={existing ? fromSupplement(existing, fmt) : EMPTY} />
}

type Stage = { kind: 'form' } | { kind: 'reading' } | { kind: 'label'; result: Extract<LabelResult, { ok: true }> }

function SupplementEditor({ id, initial }: { id: string | undefined; initial: Draft }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const [draft, setDraft] = useState(initial)
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const [labelError, setLabelError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [otherMeals, setOtherMeals] = useState(() => initial.timing.some((meal) => OTHER_MEALS.includes(meal)))
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const title = t(id ? 'food.supplement.edit' : 'food.supplement.add')

  const protein = draft.kind === 'protein'
  const amount = parseGrams(draft.doseAmount)
  const scoop = parseGrams(draft.scoopG)
  const macros = [draft.kcal, draft.protein, draft.carbs, draft.fat].map((value) => (value.trim() === '' ? 0 : parseGrams(value)))
  const macrosOk = macros.every((value) => value !== null) && parseGrams(draft.kcal) !== null
  const needsScoop = protein && draft.countsAsFood && scoop === null
  const valid = draft.name.trim().length > 0 && amount !== null && draft.timing.length > 0 && (!protein || !draft.countsAsFood || (scoop !== null && macrosOk))

  async function readLabel(file: File) {
    setLabelError(null)
    setStage({ kind: 'reading' })
    let image: Blob = file
    try {
      image = new Blob([(await compressPhoto(file, LABEL_MAX_PX, 0.85)).data], { type: 'image/jpeg' })
    } catch {
      // Pa kanavacë (p.sh. provat): dërgohet skedari siç është; funksioni e kufizon në 5 MB.
    }
    const result = await supplementLabelRemote.read(image).catch((): LabelResult => ({ ok: false, error: 'ai_failed' }))
    if (result.ok) {
      setStage({ kind: 'label', result })
      return
    }
    const known = ['offline', 'limit', 'not_label', 'unreadable'] as const
    setLabelError(t(`food.supplement.error.${(known as readonly string[]).includes(result.error) ? (result.error as (typeof known)[number]) : 'other'}`))
    setStage({ kind: 'form' })
  }

  async function save() {
    if (!valid || amount === null) return
    setBusy(true)
    setFailed(false)
    try {
      await saveSupplement(
        store,
        {
          name: draft.name,
          kind: draft.kind,
          doseAmount: amount,
          doseUnit: draft.doseUnit,
          scoopG: scoop,
          timing: draft.timing,
          macros: protein && macrosOk ? { kcal: macros[0]!, proteinG: macros[1]!, carbsG: macros[2]!, fatG: macros[3]! } : null,
          countsAsFood: protein && draft.countsAsFood,
        },
        id,
      )
      navigate(-1)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  if (stage.kind === 'label') {
    return (
      <LabelResultView
        result={stage.result}
        onContinue={() => {
          setDraft((current) => withLabel(current, stage.result.fields, fmt))
          setStage({ kind: 'form' })
        }}
        onAgain={(file) => void readLabel(file)}
      />
    )
  }

  const toggleMeal = (meal: MealKey) => set({ timing: draft.timing.includes(meal) ? draft.timing.filter((entry) => entry !== meal) : [...draft.timing, meal] })

  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={title} back={t('food.supplements')} fallback="/ushqimi" />

      <section className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-4')}>
        <PhotoButton disabled={stage.kind === 'reading'} onFile={(file) => void readLabel(file)}>
          <Icon name="kamera-foto" size={22} />
          {stage.kind === 'reading' ? t('food.supplement.reading') : t('food.supplement.photo')}
        </PhotoButton>
        <p className="text-[13px] leading-[1.4] text-muted-foreground">{t('food.supplement.photoHint')}</p>
        {labelError ? (
          <p role="alert" className="text-sm leading-5 text-danger">
            {labelError}
          </p>
        ) : null}
      </section>

      <div aria-hidden className="flex items-center gap-3 text-[13px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('food.supplement.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <TextField label={t('food.supplement.name')} value={draft.name} onChange={(name) => set({ name })} />

      <Field label={t('food.supplement.kind')}>
        <div role="radiogroup" aria-label={t('food.supplement.kind')} className="grid grid-cols-2 gap-2">
          {KINDS.map((kind) => (
            <ChoiceChip key={kind} selected={draft.kind === kind} onClick={() => set({ kind, ...(kind === draft.kind ? {} : DEFAULTS[kind]) })}>
              {t(`food.supplement.kind.${kind}`)}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      <Field label={t('food.supplement.dose')}>
        <div className="flex flex-col gap-2">
          <input
            aria-label={t('food.supplement.doseAmount')}
            inputMode="decimal"
            value={draft.doseAmount}
            onChange={(event) => set({ doseAmount: event.target.value })}
            className={cn(inputClass, 'w-28 text-center font-display text-xl font-extrabold tabular-nums')}
          />
          <div role="radiogroup" aria-label={t('food.supplement.dose')} className="flex flex-wrap gap-2">
            {UNITS.map((unit) => (
              <ChoiceChip key={unit} selected={draft.doseUnit === unit} onClick={() => set({ doseUnit: unit })}>
                {t(`food.supplement.unit.${unit}`)}
              </ChoiceChip>
            ))}
          </div>
        </div>
      </Field>

      {protein || draft.doseUnit === 'scoop' ? (
        <NumberField label={t('food.supplement.scoop')} accessible={t('food.supplement.scoopGrams')} unit="g" value={draft.scoopG} onChange={(scoopG) => set({ scoopG })} />
      ) : null}

      <Field label={t('food.supplement.when')}>
        <div className="flex flex-wrap gap-2">
          {[...MAIN_MEALS, ...(otherMeals ? OTHER_MEALS : [])].map((meal) => (
            <ChoiceChip key={meal} role="button" selected={draft.timing.includes(meal)} onClick={() => toggleMeal(meal)}>
              {mealName(t, meal)}
            </ChoiceChip>
          ))}
          {otherMeals ? null : (
            <ChoiceChip role="button" selected={false} onClick={() => setOtherMeals(true)}>
              {t('food.supplement.otherMeals')}
            </ChoiceChip>
          )}
        </div>
      </Field>

      {protein ? (
        <>
          <Field label={t('food.supplement.macros')}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['kcal', 'food.supplement.kcal'],
                  ['protein', 'food.supplement.protein'],
                  ['carbs', 'food.supplement.carbs'],
                  ['fat', 'food.supplement.fat'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[13px] text-muted-foreground">{t(label)}</span>
                  <input inputMode="decimal" value={draft[key]} onChange={(event) => set({ [key]: event.target.value })} className={cn(inputClass, 'tabular-nums')} />
                </label>
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-semibold">{t('food.supplement.countsAsFood')}</span>
              <span className="text-[13px] leading-[1.35] text-muted-foreground">{needsScoop ? t('food.supplement.needScoop') : t('food.supplement.countsAsFoodHint')}</span>
            </span>
            <Switch checked={draft.countsAsFood} label={t('food.supplement.countsAsFood')} onChange={(countsAsFood) => set({ countsAsFood })} />
          </div>
        </>
      ) : null}

      {id ? <RemoveSupplement id={id} confirming={confirming} setConfirming={setConfirming} onRemoved={() => navigate(-1)} /> : null}

      <EditorFooter>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('food.supplement.saveFailed')}
          </p>
        ) : null}
        <Button variant="primary" size="xl" disabled={busy || !valid} onClick={() => void save()}>
          {t('food.supplement.save')}
        </Button>
      </EditorFooter>
    </div>
  )
}

function LabelResultView({ result, onContinue, onAgain }: { result: Extract<LabelResult, { ok: true }>; onContinue: () => void; onAgain: (file: File) => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const month = useLocalQuery(() => aiMonth(store), [])
  const { fields } = result
  const euro = (value: number) => fmt.unit(value, '€', { minDigits: 2, maxDigits: 2 })
  const left = Math.max(0, (month?.limitEur ?? result.month.limitEur) - Math.max(month?.spentEur ?? 0, result.month.spentEur))
  const grams = (value: number | null) => (value === null ? null : fmt.unit(value, 'g', { maxDigits: 1 }))
  const rows: { label: string; value: string | null; hint?: string }[] = [
    { label: t('food.supplement.name'), value: fields.name },
    { label: t('food.supplement.kind'), value: fields.kind ? t(`food.supplement.kind.${fields.kind}`) : null },
    {
      label: t('food.supplement.dose'),
      value: fields.doseAmount === null ? null : t('food.supplement.doseText', { amount: fmt.number(fields.doseAmount, { maxDigits: 1 }), unit: fields.doseUnit ? t(`food.supplement.unit.${fields.doseUnit}`) : '' }).trim(),
    },
    ...(fields.kind === 'protein'
      ? [
          { label: t('food.supplement.scoop'), value: grams(fields.scoopG), hint: t('food.supplement.scoopMissing') },
          { label: t('food.supplement.kcal'), value: fields.kcal === null ? null : fmt.number(fields.kcal, { maxDigits: 1 }) },
          { label: t('food.protein'), value: grams(fields.proteinG) },
          { label: t('food.carbs'), value: grams(fields.carbsG) },
          { label: t('food.fat'), value: grams(fields.fatG) },
        ]
      : []),
  ]
  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={t('food.supplement.fromLabel')} back={t('food.supplement.add')} fallback="/ushqimi" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">{t('food.supplement.read', { read: result.read, total: result.total })}</p>
        <p className="text-[13px] leading-[1.4] text-muted-foreground tabular-nums">{t('food.supplement.labelCost', { cost: euro(result.costEur), left: euro(left) })}</p>
      </div>
      <dl className={cn(surfaceClass, 'm-0 flex flex-col overflow-hidden rounded-lg')}>
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-b-0">
            <dt className="text-[15px]">{row.label}</dt>
            <dd className="m-0 flex flex-col items-end text-right">
              {row.value ? (
                <span className="text-[15px] font-semibold tabular-nums">{row.value}</span>
              ) : (
                <>
                  <span className="text-[15px] font-semibold text-ember-text">{t('food.supplement.notRead')}</span>
                  {row.hint ? <span className="text-[12px] text-muted-foreground">{row.hint}</span> : null}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-[1.4] text-muted-foreground">{t('food.supplement.checkHint')}</p>
      <EditorFooter>
        <Button variant="primary" size="xl" onClick={onContinue}>
          {t('food.supplement.continue')}
        </Button>
        <PhotoButton onFile={onAgain} variant="outline">
          {t('food.supplement.again')}
        </PhotoButton>
      </EditorFooter>
    </div>
  )
}

function PhotoButton({ children, onFile, disabled, variant = 'secondary' }: { children: ReactNode; onFile: (file: File) => void; disabled?: boolean; variant?: 'secondary' | 'outline' }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex h-button cursor-pointer items-center justify-center gap-2 rounded-md border px-4 font-display text-[19px] font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground',
        variant === 'secondary' ? 'border-surface-border bg-surface-2' : 'border-border bg-transparent',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) onFile(file)
        }}
      />
      {children}
    </label>
  )
}

function RemoveSupplement({ id, confirming, setConfirming, onRemoved }: { id: string; confirming: boolean; setConfirming: (value: boolean) => void; onRemoved: () => void }) {
  const { t } = useI18n()
  if (!confirming) {
    return (
      <Button variant="ghost" className="self-start text-danger" onClick={() => setConfirming(true)}>
        {t('food.supplement.remove')}
      </Button>
    )
  }
  return (
    <div role="group" aria-label={t('food.supplement.remove')} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4')}>
      <p className="text-sm leading-5">{t('food.supplement.removeConfirm')}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void removeSupplement(store, id).then(onRemoved)}>
          {t('food.supplement.removeYes')}
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="type-label text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-label text-muted-foreground">
        {label}
      </label>
      <input id={id} value={value} maxLength={120} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </div>
  )
}

function NumberField({ label, accessible, unit, value, onChange }: { label: string; accessible: string; unit: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="type-label text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <input
          aria-label={accessible}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'w-28 text-center font-display text-xl font-extrabold tabular-nums')}
        />
        <span className="text-base text-muted-foreground">{unit}</span>
      </span>
    </div>
  )
}
