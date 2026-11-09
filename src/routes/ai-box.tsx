import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import {
  type BoxContext,
  type BoxDraft,
  type BoxError,
  type BoxFood,
  boxContext,
  chooseOption,
  draftTotals,
  logBoxDraft,
  mergeAnswer,
  removeRow,
  resolveDraft,
  setGrams,
  setMeal,
} from '@/data/ai-box'
import { boxRemote, store, useLocalQuery } from '@/data/app-data'
import { nutritionDay } from '@/data/nutrition'
import type { MonthSpend } from '@/data/pdf-import'
import type { ParseTurn } from '../../supabase/functions/log-parse/shared'
import type { I18n } from '@/i18n'
import { mealName, nameInSentence } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { boxText } from '@/lib/box-text'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/use-online'
import type { MealKey } from '@/nutrition/meals'

// Kutia e AI-së (V40, V2-E2-13; bordet V22-Kutia-*): shkrimi ose zëri i tastierës, pyetja kur mungon një
// sasi, përmbledhja ku çdo rresht ndryshohet ose hiqet, dhe "Regjistro të gjitha". Asgjë nuk shkruhet
// para konfirmimit. Pa internet teksti mbetet dhe "Dërgo" pret rrjetin (V22-Kutia-PaInternet).

type Phase = { kind: 'compose'; error: BoxError | null; month?: MonthSpend } | { kind: 'reading'; text: string } | { kind: 'review'; review: Review }

interface Review {
  draft: BoxDraft
  /** Mesazhet e përdoruesit dhe pyetjet, për një përgjigje të lirë. */
  history: ParseTurn[]
  costEur: number
}

const firstPending = (draft: BoxDraft) => draft.foods.find((row) => row.grams === null) ?? null

export function AiBoxPage() {
  const i18n = useI18n()
  const { t } = i18n
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnline()
  const [text, setText] = useState(() => boxText.get())
  const [phase, setPhase] = useState<Phase>({ kind: 'compose', error: null })
  const close = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))

  const changeText = (value: string) => {
    setText(value)
    boxText.set(value)
  }

  /** Dërgon mesazhin (ose përgjigjen e lirë te pyetja) dhe e bashkon me draftin që ekziston. */
  async function send(message: string, previous: Review | null) {
    const now = new Date()
    const history = previous?.history ?? []
    setPhase({ kind: 'reading', text: message })
    let box: BoxContext
    try {
      box = await boxContext(store, now, i18n)
    } catch {
      setPhase(previous ? { kind: 'review', review: previous } : { kind: 'compose', error: 'ai_failed' })
      return
    }
    const result = await boxRemote.parse({ ...box.request, text: message, history }).catch(() => ({ ok: false as const, error: 'ai_failed' as const }))
    if (!result.ok) {
      setPhase(previous ? { kind: 'review', review: previous } : { kind: 'compose', error: result.error, month: 'month' in result ? result.month : undefined })
      return
    }
    const resolved = await resolveDraft(store, result.draft, box, now)
    const draft = previous ? mergeAnswer(previous.draft, resolved) : resolved
    const pending = firstPending(draft)
    const turns: ParseTurn[] = [...history, { role: 'user', text: message }]
    if (pending) turns.push({ role: 'assistant', text: t('box.question.amount', { food: nameInSentence(pending.name, i18n.lang) }) })
    setPhase({ kind: 'review', review: { draft, history: turns, costEur: (previous?.costEur ?? 0) + result.costEur } })
  }

  async function logAll(draft: BoxDraft) {
    await logBoxDraft(store, draft)
    changeText('')
    close()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background pt-[var(--safe-top)] text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button variant="ghost" size="icon" aria-label={t('box.close')} className="rounded-pill" onClick={close}>
          <Icon name="mbyll-vrull" size={22} />
        </Button>
        <h1 className="min-w-0 flex-1 type-title">{t('box.title')}</h1>
      </header>
      {phase.kind === 'review' ? (
        <ReviewView
          review={phase.review}
          online={online}
          onChange={(draft) => setPhase({ kind: 'review', review: { ...phase.review, draft } })}
          onAnswer={(answer) => void send(answer, phase.review)}
          onLog={(draft) => void logAll(draft)}
        />
      ) : (
        <ComposeView
          text={text}
          online={online}
          reading={phase.kind === 'reading'}
          error={phase.kind === 'compose' ? phase.error : null}
          month={phase.kind === 'compose' ? phase.month : undefined}
          onChange={changeText}
          onSend={() => void send(text.trim(), null)}
        />
      )}
    </div>
  )
}

function useEuro() {
  const { fmt } = useI18n()
  return (value: number) => fmt.unit(value, '€', { minDigits: 2, maxDigits: 2 })
}

function errorText(t: I18n['t'], euro: (value: number) => string, error: BoxError, month?: MonthSpend): string {
  if (error === 'limit') return t('box.error.limit', { spent: euro(month?.spentEur ?? 0), limit: euro(month?.limitEur ?? 10) })
  if (error === 'too_long') return t('box.error.tooLong')
  if (error === 'unauthorized') return t('box.error.unauthorized')
  return t('box.error.failed')
}

function ComposeView({
  text,
  online,
  reading,
  error,
  month,
  onChange,
  onSend,
}: {
  text: string
  online: boolean
  reading: boolean
  error: BoxError | null
  month?: MonthSpend
  onChange: (text: string) => void
  onSend: () => void
}) {
  const { t } = useI18n()
  const euro = useEuro()
  const id = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    field.current?.focus()
  }, [])
  const canSend = online && !reading && text.trim().length > 0
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canSend) onSend()
  }
  return (
    <form onSubmit={submit} aria-label={t('box.title')} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-4">
        {reading ? (
          <>
            <p className="m-0 max-w-[300px] self-end rounded-[16px_16px_4px_16px] border border-border bg-surface-2 px-3.5 py-3 type-body-l">{text}</p>
            <p role="status" className="m-0 flex items-center gap-2 type-label text-data">
              <Icon name="shkendija" size={16} className="animate-pulse" />
              {t('box.reading')}
            </p>
          </>
        ) : (
          <p className="m-0 type-body text-muted-foreground">{t('box.example')}</p>
        )}
        {error && !reading ? (
          <p role="alert" className={cn(surfaceClass, 'm-0 rounded-lg p-3.5 type-body')}>
            {errorText(t, euro, error, month)}
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex shrink-0 flex-col gap-2.5 border-t border-border bg-background px-4 pt-3 pb-[calc(var(--safe-bottom)+16px)]">
        {online ? null : (
          <div role="status" className="flex gap-2.5 rounded-lg border border-subtle bg-surface p-3.5">
            <Icon name="pa-internet" size={20} className="mt-0.5 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="type-body-strong">{t('box.offline.title')}</span>
              <span className="type-caption text-muted-foreground">{t('box.offline.text')}</span>
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor={id} className="sr-only">
            {t('box.input')}
          </label>
          <textarea
            id={id}
            ref={field}
            rows={3}
            value={text}
            placeholder={t('box.input')}
            readOnly={reading}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[72px] min-w-0 flex-1 resize-none rounded-lg border border-subtle bg-surface px-3.5 py-3 type-body-l text-foreground placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            variant={canSend ? 'primary' : 'secondary'}
            size="icon"
            ground="page"
            aria-label={online ? t('box.send') : t('box.sendOffline')}
            disabled={!canSend}
            className="size-[52px] rounded-lg"
          >
            <Icon name="dergo" size={22} />
          </Button>
        </div>
        <p className="m-0 type-caption text-muted-foreground">{t('box.dock.hint')}</p>
      </div>
    </form>
  )
}

function ReviewView({
  review,
  online,
  onChange,
  onAnswer,
  onLog,
}: {
  review: Review
  online: boolean
  onChange: (draft: BoxDraft) => void
  onAnswer: (answer: string) => void
  onLog: (draft: BoxDraft) => void
}) {
  const pending = firstPending(review.draft)
  const said = review.history.filter((turn) => turn.role === 'user').map((turn) => turn.text)
  return pending ? (
    <QuestionView draft={review.draft} pending={pending} said={said} online={online} onChange={onChange} onAnswer={onAnswer} />
  ) : (
    <SummaryView review={review} said={said} onChange={onChange} onLog={onLog} />
  )
}

function Said({ texts }: { texts: string[] }) {
  return (
    <>
      {texts.map((text, index) => (
        <p key={index} className="m-0 max-w-[300px] self-end rounded-[16px_16px_4px_16px] border border-border bg-surface-2 px-3.5 py-3 type-body-l">
          {text}
        </p>
      ))}
    </>
  )
}

function QuestionView({
  draft,
  pending,
  said,
  online,
  onChange,
  onAnswer,
}: {
  draft: BoxDraft
  pending: BoxFood
  said: string[]
  online: boolean
  onChange: (draft: BoxDraft) => void
  onAnswer: (answer: string) => void
}) {
  const { t, fmt, lang } = useI18n()
  const headingId = useId()
  const answerId = useId()
  const [answer, setAnswer] = useState('')
  const food = nameInSentence(pending.name, lang)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (online && answer.trim()) onAnswer(answer.trim())
  }
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-4">
        <Said texts={said} />
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
          <span className="flex items-center gap-2 type-label text-data">
            <Icon name="shkendija" size={16} />
            {t('box.question.label')}
          </span>
          <h2 id={headingId} className="m-0 type-display-s">
            {t('box.question.amount', { food })}
          </h2>
          <p className="m-0 type-body text-muted-foreground">{t('box.question.why')}</p>
          <div role="group" aria-label={t('box.question.options', { food })} className="flex flex-wrap gap-2">
            {pending.options.map((option) => (
              <Button key={option.label} variant="secondary" ground="page" className="h-12 rounded-md font-text text-base font-semibold normal-case tracking-normal" onClick={() => onChange(chooseOption(draft, pending.key, option))}>
                {`${option.label} · ${fmt.unit(option.grams, 'g')}`}
              </Button>
            ))}
            <Button variant="ghost" className="h-12 rounded-md font-text text-base font-semibold normal-case tracking-normal text-muted-foreground" onClick={() => onChange(removeRow(draft, pending.key))}>
              {t('box.question.leave', { food })}
            </Button>
          </div>
        </section>
        <Understood draft={draft} />
      </div>
      <form onSubmit={submit} className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+16px)]">
        <label htmlFor={answerId} className="sr-only">
          {t('box.answer.label')}
        </label>
        <textarea
          id={answerId}
          rows={1}
          value={answer}
          placeholder={t('box.answer.label')}
          onChange={(event) => setAnswer(event.target.value)}
          className="min-h-[52px] min-w-0 flex-1 resize-none rounded-lg border border-subtle bg-surface p-3.5 type-body-l text-foreground placeholder:text-muted-foreground"
        />
        <Button type="submit" variant="secondary" ground="page" size="icon" aria-label={online ? t('box.send') : t('box.sendOffline')} disabled={!online || !answer.trim()} className="size-[52px] rounded-lg">
          <Icon name="dergo" size={22} />
        </Button>
      </form>
    </div>
  )
}

/** "Çfarë kuptova": çdo rresht me vaktin e vet; ai që pret sasinë ka "sa?". */
function Understood({ draft }: { draft: BoxDraft }) {
  const { t, fmt } = useI18n()
  const headingId = useId()
  const rows = [
    ...draft.foods.map((row) => ({ key: row.key, meal: row.meal, text: row.grams === null ? row.name : `${row.name}, ${row.portion || fmt.unit(row.grams, 'g')}`, pending: row.grams === null })),
    ...draft.supplements.map((row) => ({ key: row.key, meal: row.meal, text: row.name, pending: false })),
    ...draft.water.map((row) => ({ key: row.key, meal: null, text: `${t('box.summary.water')}, ${fmt.unit(row.ml, 'ml')}`, pending: false })),
  ]
  return (
    <section aria-labelledby={headingId} className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5 py-1')}>
      <h2 id={headingId} className="m-0 pt-2.5 pb-1.5 type-label text-muted-foreground">
        {t('box.question.understood')}
      </h2>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-touch items-center gap-3 border-t border-border type-body">
            <span className="w-[112px] shrink-0 text-muted-foreground">{row.meal ? mealName(t, row.meal) : '—'}</span>
            <span className="min-w-0 flex-1">{row.text}</span>
            {row.pending ? <span className="shrink-0 rounded-sm border border-data px-2 py-0.5 type-caption text-data">{t('box.question.missing')}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SummaryView({ review, said, onChange, onLog }: { review: Review; said: string[]; onChange: (draft: BoxDraft) => void; onLog: (draft: BoxDraft) => void }) {
  const { t, fmt } = useI18n()
  const { draft } = review
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const date = draft.foods[0]?.date ?? draft.supplements[0]?.date ?? draft.water[0]?.date
  const today = useLocalQuery(async () => (date ? nutritionDay(store, date, new Date()) : null), [date])
  const slotTime = useMemo(() => new Map((today?.meals ?? []).map((slot) => [slot.meal, slot.time])), [today])
  const groups = useMemo(() => {
    const order = new Map((today?.meals ?? []).map((slot, index) => [slot.meal, index]))
    const byGroup = new Map<string, BoxFood[]>()
    for (const row of draft.foods) {
      const key = `${row.date}|${row.meal}`
      byGroup.set(key, [...(byGroup.get(key) ?? []), row])
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      const [dateA, mealA] = a.split('|')
      const [dateB, mealB] = b.split('|')
      return dateA === dateB ? (order.get(mealA as MealKey) ?? 99) - (order.get(mealB as MealKey) ?? 99) : dateA.localeCompare(dateB)
    })
  }, [draft.foods, today])
  const empty = draft.foods.length + draft.supplements.length + draft.water.length === 0
  const added = draftTotals({ ...draft, foods: draft.foods.filter((row) => row.date === today?.date) })
  const edited = draft.foods.find((row) => row.key === editing) ?? null
  const cost = Math.max(0.001, Math.round(review.costEur * 1000) / 1000)
  const header = (row: { date: string; meal: MealKey }) => {
    const meal = mealName(t, row.meal)
    if (today && row.date !== today.date) return t('box.summary.yesterday', { meal })
    const time = slotTime.get(row.meal)
    return time ? t('box.summary.mealAt', { meal, time }) : meal
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-4 pb-4">
        <Said texts={said} />
        <h2 className="m-0 type-display-s">{t('box.summary.title')}</h2>
        {empty ? <p className="m-0 type-body-l text-muted-foreground">{t('box.summary.empty')}</p> : null}
        {groups.map(([key, rows]) => (
          <section key={key} aria-label={header(rows[0])} className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5 py-1')}>
            <h3 className="m-0 pt-2.5 pb-1.5 type-label text-muted-foreground">{header(rows[0])}</h3>
            <ul className="m-0 list-none p-0">
              {rows.map((row) => (
                <li key={row.key} className="border-t border-border">
                  <button
                    type="button"
                    aria-label={t('box.summary.edit', { name: row.name })}
                    onClick={() => setEditing(row.key)}
                    className="flex min-h-row w-full items-center gap-3 py-2 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="type-body-strong">{row.name}</span>
                      <span className="type-caption text-muted-foreground tabular-nums">
                        {[row.portion, fmt.unit(row.grams ?? 0, 'g')].filter(Boolean).join(' · ')}
                        {row.estimated || row.isNew ? ` · ${t('box.summary.estimate')}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                      <span className="type-body-strong">{fmt.unit(Math.round(row.macros.kcal), 'kcal')}</span>
                      <span className="type-caption text-muted-foreground">{fmt.unit(Math.round(row.macros.proteinG), 'g')}</span>
                    </span>
                    <Icon name="laps" size={18} className="shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {draft.supplements.length ? (
          <section aria-label={t('box.summary.supplements')} className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5 py-1')}>
            <h3 className="m-0 pt-2.5 pb-1.5 type-label text-muted-foreground">{t('box.summary.supplements')}</h3>
            <ul className="m-0 list-none p-0">
              {draft.supplements.map((row) => (
                <li key={row.key} className="flex min-h-row items-center gap-3 border-t border-border">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="type-body-strong">{row.name}</span>
                    <span className="type-caption text-muted-foreground">{`${header(row)} · ${t('box.summary.doses', { count: row.amount })}`}</span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={t('box.edit.remove')} onClick={() => onChange(removeRow(draft, row.key))} className="text-muted-foreground">
                    <Icon name="mbyll-vrull" size={18} />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {draft.water.length ? (
          <section aria-label={t('box.summary.water')} className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5 py-1')}>
            <h3 className="m-0 pt-2.5 pb-1.5 type-label text-muted-foreground">{t('box.summary.water')}</h3>
            <ul className="m-0 list-none p-0">
              {draft.water.map((row) => (
                <li key={row.key} className="flex min-h-row items-center gap-3 border-t border-border">
                  <span className="min-w-0 flex-1 type-body-strong tabular-nums">{row.time ? `${fmt.unit(row.ml, 'ml')} · ${row.time}` : fmt.unit(row.ml, 'ml')}</span>
                  <Button variant="ghost" size="icon" aria-label={t('box.edit.remove')} onClick={() => onChange(removeRow(draft, row.key))} className="text-muted-foreground">
                    <Icon name="mbyll-vrull" size={18} />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {draft.notUnderstood.length ? <p className="m-0 type-caption text-muted-foreground">{t('box.summary.notUnderstood', { text: draft.notUnderstood.join('; ') })}</p> : null}
        {today?.targets && draft.foods.length ? (
          <section aria-label={t('box.summary.after')} className="flex flex-col gap-1 tabular-nums">
            <span className="type-label text-muted-foreground">{t('box.summary.after')}</span>
            <span className="type-body-strong">
              {t('box.summary.kcal', { eaten: Math.round(today.totals.kcal + added.kcal), target: Math.round(today.targets.kcal) })}
            </span>
            <span className="type-caption text-muted-foreground">
              {t('box.summary.protein', { eaten: Math.round(today.totals.proteinG + added.proteinG), target: Math.round(today.targets.proteinG) })}
            </span>
          </section>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex shrink-0 flex-col gap-2 bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">
        <Button
          variant="primary"
          size="xl"
          disabled={empty || saving}
          onClick={() => {
            setSaving(true)
            onLog(draft)
          }}
        >
          {t('box.summary.log')}
        </Button>
        <span className="text-center type-caption text-muted-foreground tabular-nums">{t('box.summary.cost', { cost: fmt.unit(cost, '€', { minDigits: 3, maxDigits: 3 }) })}</span>
      </div>
      {edited ? (
        <EditFoodSheet
          row={edited}
          meals={(today?.meals ?? []).map((slot) => slot.meal)}
          onClose={() => setEditing(null)}
          onGrams={(grams) => onChange(setGrams(draft, edited.key, grams))}
          onMeal={(meal) => onChange(setMeal(draft, edited.key, meal))}
          onRemove={() => {
            setEditing(null)
            onChange(removeRow(draft, edited.key))
          }}
        />
      ) : null}
    </div>
  )
}

const GRAM_STEP = 10

function EditFoodSheet({
  row,
  meals,
  onClose,
  onGrams,
  onMeal,
  onRemove,
}: {
  row: BoxFood
  meals: MealKey[]
  onClose: () => void
  onGrams: (grams: number) => void
  onMeal: (meal: MealKey) => void
  onRemove: () => void
}) {
  const { t, fmt } = useI18n()
  const gramsId = useId()
  const grams = row.grams ?? 0
  const commit = (value: number) => {
    if (Number.isFinite(value) && value >= 1 && value <= 3000) onGrams(Math.round(value))
  }
  return (
    <Sheet
      title={row.name}
      description={`${fmt.unit(Math.round(row.macros.kcal), 'kcal')} · ${fmt.unit(Math.round(row.macros.proteinG), 'g')}`}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" onClick={onClose}>
          {t('box.edit.done')}
        </Button>
      }
    >
      <label htmlFor={gramsId} className="type-label text-muted-foreground">
        {t('box.edit.grams')}
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="icon" aria-label={t('box.edit.less')} className="size-[52px] rounded-md" onClick={() => commit(grams - GRAM_STEP)}>
          <span aria-hidden className="text-2xl">−</span>
        </Button>
        {/* Fusha rifillon nga gramët e rinj pas −/+ (key), pa efekt që e sinkronizon. */}
        <GramsInput key={grams} id={gramsId} grams={grams} onCommit={commit} />
        <Button variant="secondary" size="icon" aria-label={t('box.edit.more')} className="size-[52px] rounded-md" onClick={() => commit(grams + GRAM_STEP)}>
          <Icon name="plus" size={22} />
        </Button>
      </div>
      <span className="type-label text-muted-foreground">{t('box.edit.meal')}</span>
      <div role="group" aria-label={t('box.edit.meal')} className="flex flex-wrap gap-2">
        {meals.map((meal) => (
          <button
            key={meal}
            type="button"
            aria-pressed={meal === row.meal}
            onClick={() => onMeal(meal)}
            className={cn('h-touch rounded-md border px-3 type-body', meal === row.meal ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground')}
          >
            {mealName(t, meal)}
          </button>
        ))}
      </div>
      <Button variant="outline" className="mt-1 h-touch shrink-0 rounded-md font-text text-base font-semibold normal-case tracking-normal" onClick={onRemove}>
        {t('box.edit.remove')}
      </Button>
    </Sheet>
  )
}

function GramsInput({ id, grams, onCommit }: { id: string; grams: number; onCommit: (grams: number) => void }) {
  const [typed, setTyped] = useState(String(grams))
  return (
    <input
      id={id}
      inputMode="decimal"
      value={typed}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={() => onCommit(Number(typed.replace(',', '.')))}
      className="h-[52px] min-w-0 flex-1 rounded-md border border-subtle bg-background text-center font-display text-3xl font-extrabold tabular-nums text-foreground"
    />
  )
}
