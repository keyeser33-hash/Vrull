import { type ReactNode, useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { inputClass } from '@/components/ui/field-styles'
import { store, useLocalQuery } from '@/data/app-data'
import { targetsPageData } from '@/data/nutrition'
import { adjustmentOn, EMPTY_TARGETS_PROFILE, personalTargets, saveTargetsProfile, type TargetsInput } from '@/data/targets-profile'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import {
  ACTIVITY_FACTORS,
  adjustedTargets,
  DEFAULT_AGE,
  FAT_LIMITS,
  MIN_CARBS_G,
  navyBodyFat,
  PROTEIN_LIMITS,
  RATE_LIMITS,
  type Sex,
  TRAINING_KCAL_PER_KG,
  type TargetsResult,
} from '@/nutrition/calculator'
import { EditorFooter, Segmented, StepButton } from './builder-parts'
import { DEFAULT_GOAL, GOAL_ORDER, goalSummary, rateText } from './targets-format'
import { WeeklyCheckCard, WeeklyCheckSummary } from './weekly-check-card'
import { ActivityPicker, TargetsCard } from './targets-parts'

// Ushqimi › Objektivat (V32, V2-E2-03, bordi "Objektivat"): kcal dhe makrot e dy llojeve të ditës,
// si u llogaritën, të dhënat e kalkulatorit dhe "Më saktë" (yndyra, mirëmbajtja) në fletë. Numrat
// ndryshojnë me çdo zgjedhje; "Ruaj objektivat" i vendos nga sot (`saveTargetsProfile`).

type SheetName = 'yndyra' | 'mirembajtja'
const HEIGHT_DEFAULT = 175
const RATE_STEP = 0.05
const MACRO_STEP = 0.1
const MAINTENANCE = { min: 1000, max: 6000 }
const ESTIMATE_KCAL = 300

const round2 = (value: number) => Math.round(value * 100) / 100
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function TargetsPage() {
  // Data e hapjes: objektivat ruhen nga kjo ditë edhe kur faqja mbetet hapur pas mesnate.
  const [date] = useState(() => localDate(new Date()))
  const data = useLocalQuery(() => targetsPageData(store, date), [date])
  if (!data) return <TargetsSkeleton />
  return (
    <TargetsEditor
      key={data.targets.from ?? 'new'}
      date={date}
      initial={data.targets}
      from={data.targets.from}
      adjustment={adjustmentOn(data.targets.adjustments, date)}
      weightKg={data.weightKg}
      sessionsPerWeek={data.sessionsPerWeek}
    />
  )
}

function TargetsSkeleton() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={t('food.targets.title')} back={t('tab.food')} fallback="/ushqimi" />
      <div aria-hidden className="h-64 rounded-xl bg-surface" />
    </div>
  )
}

function TargetsEditor({
  date,
  initial,
  from,
  adjustment,
  weightKg,
  sessionsPerWeek,
}: {
  date: string
  initial: TargetsInput
  from: string | null
  /** Shuma e korrigjimeve javore që vlejnë sot. */
  adjustment: number
  weightKg: number | null
  sessionsPerWeek: number
}) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<TargetsInput>(() => ({ ...EMPTY_TARGETS_PROFILE, ...initial, goal: initial.goal ?? DEFAULT_GOAL }))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const set = (patch: Partial<TargetsInput>) => setDraft((current) => ({ ...current, ...patch }))
  const calculated = weightKg === null ? null : personalTargets(draft, { weightKg, sessionsPerWeek, date })
  const result = calculated && adjustedTargets(calculated, adjustment)
  const sheet = params.get('flete') as SheetName | null
  const goal = draft.goal ?? DEFAULT_GOAL

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      await saveTargetsProfile(store, draft, date)
      navigate(-1)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <BackHeader title={t('food.targets.title')} back={t('tab.food')} fallback="/ushqimi" />
        {result ? <p className="text-[15px] text-muted-foreground">{goalSummary(i18n, goal, result.ratePctPerWeek)}</p> : null}
      </div>

      {result ? (
        <TargetsCard result={result}>
          <p className="flex items-start gap-2 text-sm leading-[1.4] text-muted-foreground">
            <Icon name="info" size={18} className="mt-px shrink-0 text-data" />
            {t('food.targets.estimate', { kcal: ESTIMATE_KCAL })}
          </p>
          {result.limits.map((limit) => (
            <p key={limit} className="text-sm leading-[1.4] text-muted-foreground">
              {limit === 'carbs_floor' ? t('food.targets.limit.carbs_floor', { grams: MIN_CARBS_G }) : t('food.targets.limit.kcal_floor')}
            </p>
          ))}
        </TargetsCard>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-4 text-[15px] leading-[1.45]">{weightKg === null ? t('food.targets.noWeight') : t('food.targets.missing')}</p>
      )}

      {from !== null ? <WeeklyCheckCard date={date} /> : null}

      {result ? <Breakdown result={result} draft={draft} adjustment={adjustment} /> : null}
      {from !== null ? <WeeklyCheckSummary date={date} from={from} /> : null}

      <section aria-labelledby="targets-you" className="flex flex-col">
        <h2 id="targets-you" className="mb-1.5 type-label text-muted-foreground">
          {t('food.targets.you')}
        </h2>
        <Row name={t('food.targets.sex')}>
          <Segmented<Sex>
            label={t('food.targets.sex')}
            value={draft.sex ?? ('' as Sex)}
            onChange={(sex) => set({ sex })}
            options={[
              { value: 'male', label: t('food.targets.male') },
              { value: 'female', label: t('food.targets.female') },
            ]}
            className="w-44"
          />
        </Row>
        <BirthYearRow value={draft.birthYear} year={Number(date.slice(0, 4))} onChange={(birthYear) => set({ birthYear })} />
        <Row name={t('food.targets.height')}>
          {draft.heightCm === null ? (
            <Button variant="outline" onClick={() => set({ heightCm: HEIGHT_DEFAULT })}>
              {t('food.targets.heightSet')}
            </Button>
          ) : (
            <ValueStepper
              text={fmt.unit(draft.heightCm, 'cm')}
              down={t('food.targets.heightDown')}
              up={t('food.targets.heightUp')}
              onDown={() => set({ heightCm: clamp(draft.heightCm! - 1, 120, 230) })}
              onUp={() => set({ heightCm: clamp(draft.heightCm! + 1, 120, 230) })}
            />
          )}
        </Row>
        <Row name={t('food.targets.weight')} detail={weightKg === null ? t('food.targets.noWeight') : t('food.targets.weightHint')}>
          <Link to="/progresi/matja" className="flex min-h-touch items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
            {weightKg === null ? '–' : fmt.unit(weightKg, 'kg', { minDigits: 1, maxDigits: 1 })}
            <Icon name="hap" size={18} className="text-muted-foreground" />
          </Link>
        </Row>
        <Row name={t('food.targets.sessions')} detail={t('food.targets.sessionsHint')} last>
          <span className="font-display text-2xl font-extrabold tabular-nums">{fmt.number(sessionsPerWeek)}</span>
        </Row>
      </section>

      <ActivityPicker
        legend={<span className="type-label text-muted-foreground">{t('food.targets.activity')}</span>}
        value={draft.activity}
        onChange={(activity) => set({ activity })}
      />

      <section aria-labelledby="targets-goal" className="flex flex-col gap-2.5">
        <h2 id="targets-goal" className="type-label text-muted-foreground">
          {t('food.targets.goal')}
        </h2>
        <Segmented
          label={t('food.targets.goal')}
          value={goal}
          onChange={(next) => set({ goal: next, ratePct: null, proteinGPerKg: draft.proteinGPerKg })}
          options={GOAL_ORDER.map((value) => ({ value, label: t(`food.targets.goal.${value}`) }))}
        />
        {goal !== 'maintain' && result ? (
          <>
            <Row
              name={t('food.targets.rate')}
              detail={t('food.targets.rateHint', {
                week: round2((result.ratePctPerWeek / 100) * weightKg!),
                month: Math.round((result.ratePctPerWeek / 100) * weightKg! * 4.35 * 10) / 10,
              })}
              last
            >
              <ValueStepper
                text={rateText(i18n, goal, result.ratePctPerWeek)}
                down={t('food.targets.rateDown')}
                up={t('food.targets.rateUp')}
                onDown={() => set({ ratePct: clamp(round2(result.ratePctPerWeek - RATE_STEP), RATE_LIMITS[goal].min, RATE_LIMITS[goal].max) })}
                onUp={() => set({ ratePct: clamp(round2(result.ratePctPerWeek + RATE_STEP), RATE_LIMITS[goal].min, RATE_LIMITS[goal].max) })}
              />
            </Row>
            <p className="text-sm leading-[1.4] text-muted-foreground">
              {goal === 'gain'
                ? t('food.targets.rateNoteGain', { low: RATE_LIMITS.gain.default, high: RATE_LIMITS.gain.max })
                : t('food.targets.rateNoteLose', { max: RATE_LIMITS.lose.max })}
            </p>
          </>
        ) : null}
      </section>

      {result ? (
        <section aria-labelledby="targets-macros" className="flex flex-col">
          <h2 id="targets-macros" className="mb-1.5 type-label text-muted-foreground">
            {t('food.targets.macros')}
          </h2>
          <Row name={t('food.protein')} detail={t('food.targets.perDay', { grams: result.rest.proteinG })}>
            <ValueStepper
              text={t('food.targets.perKg', { value: result.proteinGPerKg })}
              down={t('food.targets.proteinDown')}
              up={t('food.targets.proteinUp')}
              onDown={() => set({ proteinGPerKg: clamp(round2(result.proteinGPerKg - MACRO_STEP), PROTEIN_LIMITS.min, PROTEIN_LIMITS.max) })}
              onUp={() => set({ proteinGPerKg: clamp(round2(result.proteinGPerKg + MACRO_STEP), PROTEIN_LIMITS.min, PROTEIN_LIMITS.max) })}
            />
          </Row>
          <Row name={t('food.fat')} detail={t('food.targets.perDay', { grams: result.rest.fatG })}>
            <ValueStepper
              text={t('food.targets.perKg', { value: result.fatGPerKg })}
              down={t('food.targets.fatDown')}
              up={t('food.targets.fatUp')}
              onDown={() => set({ fatGPerKg: clamp(round2(result.fatGPerKg - MACRO_STEP), FAT_LIMITS.min, FAT_LIMITS.max) })}
              onUp={() => set({ fatGPerKg: clamp(round2(result.fatGPerKg + MACRO_STEP), FAT_LIMITS.min, FAT_LIMITS.max) })}
            />
          </Row>
          <Row name={t('food.carbs')} detail={t('food.targets.carbsHint')} last>
            <span className="font-display text-xl font-bold text-muted-foreground tabular-nums">
              {fmt.number(result.rest.carbsG)}–{fmt.unit(result.training.carbsG, 'g')}
            </span>
          </Row>
        </section>
      ) : null}

      <section aria-labelledby="targets-better" className="flex flex-col">
        <h2 id="targets-better" className="type-label text-muted-foreground">
          {t('food.targets.better')}
        </h2>
        <p className="mb-1 text-[13px] leading-[1.4] text-muted-foreground">{t('food.targets.betterHint')}</p>
        <LinkRow
          name={t('food.targets.bodyFat')}
          value={draft.bodyFatPct === null ? t('food.targets.no') : `${fmt.number(draft.bodyFatPct, { maxDigits: 1 })}%`}
          onClick={() => setParams({ flete: 'yndyra' })}
        />
        <LinkRow
          name={t('food.targets.knownMaintenance')}
          value={draft.maintenanceKcal === null ? t('food.targets.no') : `${fmt.number(draft.maintenanceKcal)} kcal`}
          onClick={() => setParams({ flete: 'mirembajtja' })}
          last
        />
      </section>

      <EditorFooter>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('food.targets.saveFailed')}
          </p>
        ) : null}
        <Button variant="primary" size="xl" disabled={!result || busy} onClick={save}>
          {t('food.targets.save')}
        </Button>
        <span className="text-center text-[13px] text-muted-foreground">{t('food.targets.saveNote')}</span>
      </EditorFooter>

      {sheet === 'yndyra' && weightKg !== null ? (
        <BodyFatSheet
          draft={draft}
          weightKg={weightKg}
          sessionsPerWeek={sessionsPerWeek}
          date={date}
          onUse={(bodyFatPct) => {
            set({ bodyFatPct })
            navigate(-1)
          }}
          onClose={() => navigate(-1)}
        />
      ) : null}
      {sheet === 'mirembajtja' ? (
        <MaintenanceSheet
          initial={draft.maintenanceKcal}
          onUse={(maintenanceKcal) => {
            set({ maintenanceKcal })
            navigate(-1)
          }}
          onClose={() => navigate(-1)}
        />
      ) : null}
    </div>
  )
}

function Breakdown({ result, draft, adjustment }: { result: TargetsResult; draft: TargetsInput; adjustment: number }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const goal = draft.goal ?? DEFAULT_GOAL
  const plus = (value: number) => `${value >= 0 ? '+' : '−'}${fmt.number(Math.abs(value))}`
  const rows: { label: string; value: string; tone?: 'data' | 'total' }[] = [
    ...(result.formula === 'known' ? [] : [{ label: t('food.targets.bmr'), value: fmt.number(result.breakdown.bmr) }]),
    {
      label:
        result.formula === 'known'
          ? t('food.targets.maintenanceKnown')
          : t('food.targets.maintenance', { activity: t(`food.targets.activity.${draft.activity!}`), factor: ACTIVITY_FACTORS[draft.activity!] }),
      value: fmt.number(result.breakdown.maintenanceRest),
    },
    ...(goal === 'maintain'
      ? []
      : [
          {
            label: t(goal === 'gain' ? 'food.targets.surplus' : 'food.targets.deficit', { rate: rateText(i18n, goal, result.ratePctPerWeek) }),
            value: plus(result.breakdown.adjustment),
            tone: 'data' as const,
          },
        ]),
    ...(adjustment === 0 ? [] : [{ label: t('food.targets.adjustments'), value: plus(adjustment), tone: 'data' as const }]),
    { label: t('food.targets.rest'), value: fmt.number(result.breakdown.rest), tone: 'total' },
    { label: t('food.targets.trainingExtra', { kcal: TRAINING_KCAL_PER_KG }), value: plus(result.breakdown.trainingExtra), tone: 'data' },
    { label: t('food.targets.training'), value: fmt.number(result.breakdown.training), tone: 'total' },
  ]
  return (
    <section aria-labelledby="targets-how" className="flex flex-col">
      <h2 id="targets-how" className="mb-1.5 type-label text-muted-foreground">
        {t('food.targets.how')}
      </h2>
      <dl className="m-0">
        {rows.map((row, index) => (
          <div key={row.label} className={cn('flex min-h-10 items-center justify-between gap-3 text-[15px]', index < rows.length - 1 && 'border-b border-border', row.tone === 'total' && 'font-semibold')}>
            <dt>{row.label}</dt>
            <dd className={cn('m-0 font-display text-[19px] font-bold tabular-nums', row.tone === 'data' && 'text-data', row.tone === 'total' && 'font-extrabold')}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Row({ name, detail, children, last }: { name: string; detail?: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex min-h-[60px] items-center justify-between gap-3 py-1.5', !last && 'border-b border-border')}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base">{name}</span>
        {detail ? <span className="text-[13px] leading-[1.35] text-muted-foreground">{detail}</span> : null}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function ValueStepper({ text, down, up, onDown, onUp }: { text: string; down: string; up: string; onDown: () => void; onUp: () => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <StepButton label={down} sign="−" onClick={onDown} />
      <span aria-live="polite" className="min-w-[76px] text-center font-display text-[22px] font-extrabold tabular-nums">
        {text}
      </span>
      <StepButton label={up} sign="+" onClick={onUp} />
    </span>
  )
}

function LinkRow({ name, value, onClick, last }: { name: string; value: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-14 items-center justify-between gap-3 text-left text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        !last && 'border-b border-border',
      )}
    >
      <span>{name}</span>
      <span className="flex items-center gap-1.5 text-[15px] text-muted-foreground">
        {value}
        <Icon name="hap" size={18} />
      </span>
    </button>
  )
}

function BirthYearRow({ value, year, onChange }: { value: number | null; year: number; onChange: (value: number | null) => void }) {
  const { t } = useI18n()
  const id = useId()
  const [text, setText] = useState(value === null ? '' : String(value))
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-border py-1.5">
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base">{t('food.targets.birthYear')}</span>
        <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('food.targets.birthYearHint', { age: DEFAULT_AGE })}</span>
      </label>
      <input
        id={id}
        inputMode="numeric"
        maxLength={4}
        placeholder={String(year - DEFAULT_AGE)}
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '')
          setText(next)
          const parsed = Number(next)
          if (next === '') onChange(null)
          else if (next.length === 4 && parsed >= year - 100 && parsed <= year - 14) onChange(parsed)
        }}
        className={cn(inputClass, 'w-24 text-center font-display text-xl font-extrabold')}
      />
    </div>
  )
}

function BodyFatSheet({
  draft,
  weightKg,
  sessionsPerWeek,
  date,
  onUse,
  onClose,
}: {
  draft: TargetsInput
  weightKg: number
  sessionsPerWeek: number
  date: string
  onUse: (pct: number | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'percent' | 'tape'>('tape')
  const [percent, setPercent] = useState(draft.bodyFatPct === null ? '' : String(draft.bodyFatPct))
  const [neck, setNeck] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const num = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')))
  const sex = draft.sex ?? 'male'
  let pct: number | null = null
  if (mode === 'percent') {
    const value = num(percent)
    pct = value !== null && value >= 3 && value <= 60 ? value : null
  } else if (draft.heightCm !== null && num(neck) !== null && num(waist) !== null) {
    pct = navyBodyFat({ sex, heightCm: draft.heightCm, neckCm: num(neck)!, waistCm: num(waist)!, hipCm: num(hip) })
  }
  const rounded = pct === null ? null : Math.round(pct)
  const preview = rounded === null ? null : personalTargets({ ...draft, bodyFatPct: rounded }, { weightKg, sessionsPerWeek, date })
  const filled = mode === 'percent' ? percent !== '' : neck !== '' && waist !== '' && (sex === 'male' || hip !== '')
  const fields = mode === 'percent' ? [{ key: 'percent', label: t('food.targets.fatPercent'), value: percent, set: setPercent }] : [
    { key: 'neck', label: t('food.targets.neck'), value: neck, set: setNeck },
    { key: 'waist', label: t('food.targets.waist'), value: waist, set: setWaist },
    ...(sex === 'female' ? [{ key: 'hip', label: t('food.targets.hip'), value: hip, set: setHip }] : []),
  ]

  return (
    <Sheet
      title={t('food.targets.fatTitle')}
      description={t('food.targets.fatText')}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" size="xl" disabled={rounded === null} onClick={() => onUse(rounded)}>
            {rounded === null ? t('food.targets.fatUse', { pct: '–' }) : t('food.targets.fatUse', { pct: rounded })}
          </Button>
          {draft.bodyFatPct !== null ? (
            <Button variant="ghost" onClick={() => onUse(null)}>
              {t('food.targets.remove')}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label={t('food.targets.fatMode')}
          value={mode}
          onChange={setMode}
          ground="card"
          options={[
            { value: 'percent', label: t('food.targets.fatModePercent') },
            { value: 'tape', label: t('food.targets.fatModeTape') },
          ]}
        />
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {field.label}
              <input inputMode="decimal" value={field.value} onChange={(event) => field.set(event.target.value)} className={cn(inputClass, 'h-14 font-display text-2xl font-extrabold')} />
            </label>
          ))}
        </div>
        {mode === 'tape' ? <p className="text-sm leading-[1.4] text-muted-foreground">{t('food.targets.tapeHint')}</p> : null}
        {rounded !== null ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3.5">
            <span className="font-display text-[34px] leading-none font-extrabold tabular-nums">{t('food.targets.fatResult', { pct: rounded })}</span>
            <span className="text-sm text-muted-foreground">{t('food.targets.lean', { kg: Math.round(weightKg * (1 - rounded / 100)) })}</span>
            {preview ? <span className="text-[15px] leading-[1.4]">{t('food.targets.withThis', { training: preview.training.kcal, rest: preview.rest.kcal })}</span> : null}
          </div>
        ) : filled ? (
          <p className="text-sm text-danger">{t('food.targets.fatInvalid')}</p>
        ) : null}
      </div>
    </Sheet>
  )
}

function MaintenanceSheet({ initial, onUse, onClose }: { initial: number | null; onUse: (kcal: number | null) => void; onClose: () => void }) {
  const { t } = useI18n()
  const id = useId()
  const [text, setText] = useState(initial === null ? '' : String(initial))
  const value = text === '' ? null : Number(text)
  const valid = value !== null && Number.isInteger(value) && value >= MAINTENANCE.min && value <= MAINTENANCE.max
  return (
    <Sheet
      title={t('food.targets.maintTitle')}
      description={t('food.targets.maintText')}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" size="xl" disabled={!valid} onClick={() => onUse(value)}>
            {t('food.targets.maintUse')}
          </Button>
          {initial !== null ? (
            <Button variant="ghost" onClick={() => onUse(null)}>
              {t('food.targets.remove')}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {t('food.targets.maintLabel')}
        </label>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          aria-invalid={text !== '' && !valid}
          onChange={(event) => setText(event.target.value.replace(/\D/g, ''))}
          className={cn(inputClass, 'h-14 font-display text-2xl font-extrabold')}
        />
        {text !== '' && !valid ? <p className="text-sm text-danger">{t('food.targets.maintInvalid', { min: MAINTENANCE.min, max: MAINTENANCE.max })}</p> : null}
      </div>
    </Sheet>
  )
}
