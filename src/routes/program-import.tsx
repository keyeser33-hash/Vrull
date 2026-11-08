import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { MAX_PDF_BYTES } from '../../supabase/functions/program-import/shared'
import { LibraryPicker } from '@/components/forms/library-picker'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { programImportRemote, store, useLocalQuery } from '@/data/app-data'
import { aiMonth } from '@/data/ai-usage'
import { knownExercises, type MonthSpend, type ReadError, type ReadSuccess, saveImportedDraft } from '@/data/pdf-import'
import { programBlockName, programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { loadLibrary } from '@/program/library'
import { buildProgram, type Choice, choiceKey, choiceName, draftCounts, type ExerciseQuestion, type Matching, matchExercises, type PreviewDay, previewDays } from '@/program/pdf-import'
import { euro, euroLimit, fileSize } from './ai-format'
import { prescriptionValue } from './builder-format'
import { EditorBar, EditorFooter } from './builder-parts'
import { useEditorPaths, useSheet } from './editor-nav'

// Importi i programit nga PDF me AI (V2-E1-11; bordi "Importo nga PDF"): zgjedhja e skedarit, leximi,
// "Kontrollo N ushtrime" për ushtrimet ku AI-ja nuk ishte e sigurt (Po, alternativa, Tjetër), parapamja e
// programit dhe "Krijo programin", që e ruan si draft dhe e hap te ndërtuesi (V2-E1-10). Hapet nga
// Programet (`/programet/importo`) dhe nga hapat e parë (`/fillimi/importo`, brenda faqes së hapave, si
// "Ndërto timin"). Drafti krijohet vetëm me "Krijo programin": një import i anuluar nuk lë program pas.
// Kostoja dhe kufiri jetojnë në server; këtu tregohen ato që kthen funksioni dhe, para leximit, muaji
// nga baza lokale (te kufiri i arritur AI-ja nuk thirret, V25).

type Phase =
  | { kind: 'choose' }
  | { kind: 'reading'; file: File; started: number }
  | { kind: 'read'; file: File; result: ReadSuccess; matching: Matching }
  | { kind: 'failed'; file: File | null; error: ReadError; month?: MonthSpend; costEur?: number }

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
const isPdfFile = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
/** Kufiri i skedarit me fjalë: "15 MB". */
const maxSize = (fmt: ReturnType<typeof useI18n>['fmt']) => fmt.unit(MAX_PDF_BYTES / (1024 * 1024), 'MB')
/** Gabimet ku "Provo përsëri" me të njëjtin skedar ka kuptim. */
const RETRY: ReadError[] = ['offline', 'bad_request', 'timeout', 'ai_failed']

export function ProgramImportPage() {
  const { t, fmt, lang } = useI18n()
  const navigate = useNavigate()
  const paths = useEditorPaths()
  const { params, sheet, open, close } = useSheet()
  const month = useLocalQuery(() => aiMonth(store), [])
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' })
  const [answers, setAnswers] = useState<Record<number, Choice>>({})
  const [missing, setMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const back = paths.onboarding ? '/fillimi?hapi=programi' : '/programet'
  const buildYourself = paths.onboarding ? paths.programmes : '/programet'
  const choose = () => input.current?.click()

  async function read(file: File) {
    setAnswers({})
    setMissing(false)
    setSaveFailed(false)
    if (!isPdfFile(file)) return setPhase({ kind: 'failed', file, error: 'not_pdf' })
    if (file.size > MAX_PDF_BYTES) return setPhase({ kind: 'failed', file, error: 'too_large' })
    setPhase({ kind: 'reading', file, started: Date.now() })
    try {
      const library = await loadLibrary()
      const known = await knownExercises(store, library)
      const result = await programImportRemote.read({ file, fileName: file.name, known: known.names, language: lang })
      if (!alive.current) return
      if (!result.ok) return setPhase({ kind: 'failed', file, error: result.error, month: result.month, costEur: result.costEur })
      setPhase({ kind: 'read', file, result, matching: matchExercises(result.draft, { own: known.own, library }) })
    } catch {
      // Një gabim i papritur (p.sh. biblioteka nuk u ngarkua) nuk e lë ekranin te "AI po e lexon".
      if (alive.current) setPhase({ kind: 'failed', file, error: 'ai_failed' })
    }
  }

  async function create(current: Extract<Phase, { kind: 'read' }>) {
    const pending = current.matching.questions.filter((question) => !answers[question.index])
    if (pending.length > 0) {
      setMissing(true)
      const card = document.getElementById(questionId(pending[0].index))
      card?.focus()
      card?.scrollIntoView?.({ block: 'center' })
      return
    }
    setSaving(true)
    setSaveFailed(false)
    try {
      const choices = current.matching.choices.map((choice, index) => choice ?? answers[index])
      const programId = await saveImportedDraft(store, buildProgram(current.result.draft, choices))
      navigate(paths.program(programId), { replace: true })
    } catch {
      setSaveFailed(true)
      setSaving(false)
    }
  }

  const limitReached =
    (phase.kind === 'failed' && phase.error === 'limit') || (phase.kind === 'choose' && month?.reached === true)
  const spend: MonthSpend | null =
    phase.kind === 'read' ? phase.result.month : phase.kind === 'failed' && phase.month ? phase.month : month ? { month: month.month, spentEur: month.spentEur, limitEur: month.limitEur } : null
  const pickIndex = Number(params.get('ushtrimi'))
  const pickQuestion = phase.kind === 'read' && sheet === 'tjeter' ? phase.matching.questions.find((question) => question.index === pickIndex) : undefined

  return (
    // Lartësia e ekranit pa kornizën (pt-5, pb safe + 24 px), që veprimi të rrijë poshtë edhe kur faqja është e shkurtër.
    <div className="flex min-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-44px)] flex-col gap-4">
      <EditorBar icon="back" label={t('ai.import.back')} fallback={back} title={t('ai.import.title')} heading />
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        aria-label={t('ai.import.file')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void read(file)
        }}
      />

      {limitReached && spend && month ? (
        <LimitCard spend={spend} resetsOn={month.resetsOn} onBuild={() => navigate(buildYourself, { replace: true })} />
      ) : phase.kind === 'choose' ? (
        <ChooseCard spend={spend} />
      ) : (
        <FileCard phase={phase} onChange={choose} />
      )}

      {phase.kind === 'failed' && phase.error !== 'limit' ? (
        <div role="alert" className={cn(surfaceClass, 'flex flex-col gap-1 rounded-lg p-3.5')}>
          <h2 className="type-title">{t('ai.error.title')}</h2>
          <p className="type-body text-muted-foreground">{t(`ai.error.${phase.error}`, { size: maxSize(fmt) })}</p>
          {phase.costEur ? <p className="type-caption text-muted-foreground tabular-nums">{t('ai.error.cost', { cost: euro(fmt, phase.costEur) })}</p> : null}
        </div>
      ) : null}

      {phase.kind === 'read' ? (
        <>
          {phase.matching.questions.length > 0 ? (
            <Questions questions={phase.matching.questions} answers={answers} onAnswer={(index, choice) => setAnswers((current) => ({ ...current, [index]: choice }))} onOther={(index) => open('tjeter', { ushtrimi: String(index) })} />
          ) : null}
          <Preview result={phase.result} days={previewDays(phase.result.draft, phase.matching.choices.map((choice, index) => choice ?? answers[index] ?? null))} />
        </>
      ) : null}

      <div aria-hidden className="-mt-4 flex-1" />
      {phase.kind === 'reading' || limitReached ? null : (
        <EditorFooter>
          {phase.kind === 'read' ? (
            <>
              {missing && phase.matching.questions.some((question) => !answers[question.index]) ? (
                <p role="alert" className="text-center type-caption text-danger">
                  {t('ai.check.missing', { count: phase.matching.questions.filter((question) => !answers[question.index]).length })}
                </p>
              ) : saveFailed ? (
                <p role="alert" className="text-center type-caption text-danger">
                  {t('ai.preview.failed')}
                </p>
              ) : (
                <p className="text-center type-caption text-muted-foreground">{t('ai.preview.footer')}</p>
              )}
              <Button variant="primary" size="xl" disabled={saving} onClick={() => void create(phase)}>
                {saving ? t('ai.preview.creating') : t('ai.preview.create')}
              </Button>
            </>
          ) : phase.kind === 'failed' && phase.file && RETRY.includes(phase.error) ? (
            <Button variant="primary" size="xl" onClick={() => void read(phase.file!)}>
              {t('common.retry')}
            </Button>
          ) : (
            <Button variant="primary" size="xl" onClick={choose}>
              {t('ai.import.choose')}
            </Button>
          )}
        </EditorFooter>
      )}

      {pickQuestion ? (
        <Sheet title={t('ai.check.pickTitle')} description={t('ai.check.pickText', { name: pickQuestion.pdfName })} onClose={close}>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setAnswers((current) => ({ ...current, [pickQuestion.index]: pickQuestion.fallback }))
              close()
            }}
          >
            {t('ai.check.new')}
          </Button>
          <LibraryPicker
            onPick={(exercise) => {
              setAnswers((current) => ({ ...current, [pickQuestion.index]: { kind: 'library', exercise } }))
              close()
            }}
          />
        </Sheet>
      ) : null}
    </div>
  )
}

const questionId = (index: number) => `pdf-pyetja-${index}`

/** Para skedarit: çfarë bën importi, kufiri i skedarit dhe sa ka harxhuar AI-ja këtë muaj. */
function ChooseCard({ spend }: { spend: MonthSpend | null }) {
  const { t, fmt } = useI18n()
  return (
    <section aria-labelledby="pdf-zgjidh" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-3.5')}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-touch shrink-0 items-center justify-center rounded-sm bg-surface-2 text-muted-foreground">
          <Icon name="skedari" size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="pdf-zgjidh" className="type-title">
            {t('ai.import.chooseTitle')}
          </h2>
          <p className="type-body text-muted-foreground">{t('ai.import.chooseText')}</p>
        </div>
      </div>
      <p className="border-t border-border pt-2.5 type-caption text-muted-foreground tabular-nums">
        {t('ai.import.limits', { size: maxSize(fmt) })}
        {spend ? ` ${t('ai.import.monthSoFar', { spent: euro(fmt, spend.spentEur), limit: euroLimit(fmt, spend.limitEur) })}` : null}
      </p>
    </section>
  )
}

/** Karta e skedarit (bordi): emri, faqet dhe madhësia, "Ndrysho"; leximi ose "AI e lexoi" me koston. */
function FileCard({ phase, onChange }: { phase: Exclude<Phase, { kind: 'choose' }>; onChange: () => void }) {
  const { t, fmt } = useI18n()
  const file = phase.file
  const size = file ? fileSize(fmt, file.size) : ''
  const meta = phase.kind === 'read' ? t('ai.import.pages', { count: phase.result.draft.pages, size }) : size
  return (
    <div className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-3.5')}>
      {file ? (
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-touch shrink-0 items-center justify-center rounded-sm bg-surface-2 text-muted-foreground">
            <Icon name="skedari" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-body-strong">{file.name}</span>
            <span className="type-caption text-muted-foreground tabular-nums">{meta}</span>
          </span>
          {phase.kind === 'reading' ? null : (
            <Button variant="outline" aria-label={t('ai.import.changeLabel')} onClick={onChange}>
              {t('ai.import.change')}
            </Button>
          )}
        </div>
      ) : null}
      {phase.kind === 'reading' ? <Reading started={phase.started} /> : null}
      {phase.kind === 'read' ? <ReadSummary result={phase.result} /> : null}
    </div>
  )
}

/** "AI po e lexon", me sekondat që kalojnë (funksioni ndalet vetë pas 140 s). */
function Reading({ started }: { started: number }) {
  const { t, fmt } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - started) / 1000))
  return (
    <div role="status" className="flex flex-col gap-1 border-t border-border pt-2.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="type-body-strong">{t('ai.import.reading')}</span>
        <span className="type-caption text-muted-foreground tabular-nums">{fmt.unit(seconds, 's')}</span>
      </span>
      <span className="type-caption text-muted-foreground">{t('ai.import.readingText')}</span>
    </div>
  )
}

function ReadSummary({ result }: { result: ReadSuccess }) {
  const { t, fmt } = useI18n()
  const { month, usage } = result
  const spent = euro(fmt, month.spentEur)
  const limit = euroLimit(fmt, month.limitEur)
  return (
    <>
      <div className="flex items-center gap-2 border-t border-border pt-2.5">
        <Icon name="zgjedhur" size={20} className="text-success" />
        <span className="type-body tabular-nums">
          <strong className="font-semibold text-success">{t('ai.import.done')}</strong>
          {` · ${t('ai.import.doneMeta', { count: result.draft.pages, seconds: Math.max(1, Math.round(usage.ms / 1000)) })}`}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap justify-between gap-x-3 type-caption tabular-nums">
          <span>{t('ai.import.cost', { cost: euro(fmt, usage.costEur) })}</span>
          <span className="text-muted-foreground">{t('ai.import.month', { spent, limit })}</span>
        </div>
        <span role="img" aria-label={t('ai.import.monthLabel', { spent, limit })}>
          <ProgressTrack ratio={month.limitEur > 0 ? month.spentEur / month.limitEur : 1} tone="data" />
        </span>
      </div>
    </>
  )
}

/** Kufiri i arritur (V25): AI-ja nuk thirret deri në muajin tjetër; ndërtuesi mbetet. */
function LimitCard({ spend, resetsOn, onBuild }: { spend: MonthSpend; resetsOn: Date; onBuild: () => void }) {
  const { t, fmt } = useI18n()
  return (
    <section role="alert" aria-labelledby="pdf-kufiri" className="flex flex-col gap-2.5 rounded-lg border border-insight-border bg-insight p-3.5">
      <h2 id="pdf-kufiri" className="type-title">
        {t('ai.limit.title')}
      </h2>
      <p className="type-body-l tabular-nums">
        {t('ai.limit.text', { spent: euro(fmt, spend.spentEur), limit: euroLimit(fmt, spend.limitEur), date: fmt.date(resetsOn, { weekday: false }) })}
      </p>
      <p className="type-body text-muted-foreground">{t('ai.limit.others')}</p>
      <Button variant="secondary" size="lg" className="self-start" onClick={onBuild}>
        {t('ai.limit.build')}
      </Button>
    </section>
  )
}

/** "Kontrollo N ushtrime": për çdo ushtrim të pasigurt, Po / alternativa / Tjetër (bordi). */
function Questions({
  questions,
  answers,
  onAnswer,
  onOther,
}: {
  questions: ExerciseQuestion[]
  answers: Record<number, Choice>
  onAnswer: (index: number, choice: Choice) => void
  onOther: (index: number) => void
}) {
  const { t } = useI18n()
  return (
    <section aria-labelledby="pdf-kontrollo" className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h2 id="pdf-kontrollo" className="type-title">
          {t('ai.check.title', { count: questions.length })}
        </h2>
        <span className="type-caption text-muted-foreground">{t('ai.check.text')}</span>
      </div>
      {questions.map((question) => (
        <QuestionCard key={question.index} question={question} answer={answers[question.index] ?? null} onAnswer={(choice) => onAnswer(question.index, choice)} onOther={() => onOther(question.index)} />
      ))}
    </section>
  )
}

function QuestionCard({ question, answer, onAnswer, onOther }: { question: ExerciseQuestion; answer: Choice | null; onAnswer: (choice: Choice) => void; onOther: () => void }) {
  const { t } = useI18n()
  const titleId = useId()
  const first = question.suggestion ?? question.fallback
  const options = [{ label: question.suggestion ? t('ai.check.yes') : t('ai.check.new'), choice: first }, ...(question.alternative ? [{ label: choiceName(question.alternative), choice: question.alternative }] : [])]
  const answerKey = answer ? choiceKey(answer) : null
  const other = answerKey !== null && !options.some((option) => choiceKey(option.choice) === answerKey)
  const chip = (checked: boolean) =>
    cn(
      'h-touch min-w-14 rounded-md border px-3.5 font-display text-[17px] leading-none font-bold tracking-[0.02em] uppercase',
      checked ? 'border-foreground bg-foreground text-background' : 'border-insight-border bg-background text-foreground',
      focusRing,
    )
  return (
    <div id={questionId(question.index)} tabIndex={-1} className={cn('flex flex-col gap-1.5 rounded-lg border border-insight-border bg-insight px-3.5 py-3 outline-none', focusRing)}>
      <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{t('ai.check.source', { page: question.page, name: question.pdfName })}</span>
      <span id={titleId} className="type-title">
        {question.suggestion ? t('ai.check.question', { name: choiceName(question.suggestion) }) : t('ai.check.unknown')}
      </span>
      <div role="radiogroup" aria-labelledby={titleId} className="flex flex-wrap gap-1.5 pt-0.5">
        {options.map((option) => {
          const checked = answerKey === choiceKey(option.choice)
          return (
            <button key={choiceKey(option.choice)} type="button" role="radio" aria-checked={checked} className={chip(checked)} onClick={() => onAnswer(option.choice)}>
              {option.label}
            </button>
          )
        })}
        <button type="button" role="radio" aria-checked={other} className={chip(other)} onClick={onOther}>
          {t('ai.check.other')}
        </button>
      </div>
      {other && answer ? <span className="type-caption">{t('ai.check.chosen', { name: choiceName(answer) })}</span> : null}
    </div>
  )
}

/** Parapamja: emri, numrat, blloqet si shirita javësh dhe ditët me ushtrimet (e para e hapur). */
function Preview({ result, days }: { result: ReadSuccess; days: PreviewDay[] }) {
  const { t } = useI18n()
  const { draft } = result
  const counts = draftCounts(draft)
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  const blocks = draft.blocks.map((block) => ({ name: programBlockName(t, block.name), weeks: Math.max(1, block.weeks) }))
  // Ditët e mbyllura me radhë bashkohen në një kartë, si te bordi.
  const groups: { open: boolean; days: number[] }[] = []
  days.forEach((_, index) => {
    const isOpen = open.has(index)
    const last = groups.at(-1)
    if (last && !last.open && !isOpen) last.days.push(index)
    else groups.push({ open: isOpen, days: [index] })
  })
  return (
    <section aria-labelledby="pdf-programi" className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h2 id="pdf-programi" className="type-display-s break-words">
          {draft.name}
        </h2>
        <span className="mt-1 type-caption text-muted-foreground tabular-nums">
          {[t('builder.count.blocks', { count: counts.blocks }), t('builder.count.weeks', { count: counts.weeks }), t('builder.count.days', { count: counts.days }), t('builder.count.exercises', { count: counts.exercises })].join(' · ')}
        </span>
      </div>
      <div
        role="img"
        aria-label={t('ai.preview.blocks', { list: blocks.map((block) => t('ai.preview.blockWeeksLabel', { name: block.name, count: block.weeks })).join(', ') })}
        className={cn(surfaceClass, 'grid gap-2 rounded-lg px-3.5 py-3')}
        style={{ gridTemplateColumns: `repeat(${Math.min(blocks.length, 4)}, minmax(0, 1fr))` }}
      >
        {blocks.map((block, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex gap-[3px]">
              {Array.from({ length: block.weeks }, (_, week) => (
                <span key={week} className="h-2.5 min-w-0 flex-1 rounded-[3px] bg-subtle" />
              ))}
            </div>
            {/* "Faza 1 · 4 j" në një rresht; kur nuk nxë, javët kalojnë poshtë të plota. */}
            <span className="flex flex-wrap gap-x-1 text-[13px] leading-[1.35] tabular-nums">
              <span className="min-w-0 break-words">{block.name}</span>
              <span className="whitespace-nowrap">{t('ai.preview.blockWeeks', { weeks: block.weeks })}</span>
            </span>
          </div>
        ))}
      </div>
      {groups.map((group) =>
        group.open ? (
          <OpenDay key={group.days[0]} day={days[group.days[0]]} number={group.days[0] + 1} onToggle={() => toggle(group.days[0])} />
        ) : (
          <ul key={group.days[0]} className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
            {group.days.map((index) => (
              <li key={index} className="border-t border-border first:border-t-0">
                <DayToggle day={days[index]} number={index + 1} expanded={false} onToggle={() => toggle(index)} />
              </li>
            ))}
          </ul>
        ),
      )}
    </section>
  )
}

function dayDetail(t: ReturnType<typeof useI18n>['t'], day: PreviewDay, short: boolean) {
  const known = day.slots.length - day.toCheck
  if (short) return `${day.slots.length} · ${day.toCheck ? t('ai.preview.toCheck', { count: day.toCheck }) : t('ai.preview.allKnown')}`
  return [t('ai.preview.known', { count: known }), day.toCheck ? t('ai.preview.toCheck', { count: day.toCheck }) : null].filter(Boolean).join(' · ')
}

/** Rreshti i ditës së mbyllur: "Dita 2 · Shpinë, biceps" dhe "6 · 1 për t'u kontrolluar"; e hap. */
function DayToggle({ day, number, expanded, onToggle }: { day: PreviewDay; number: number; expanded: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  return (
    <button type="button" aria-expanded={expanded} onClick={onToggle} className={cn('flex min-h-touch w-full items-center justify-between gap-2.5 px-3.5 py-1 text-left', focusRing)}>
      <span className="min-w-0 type-body-strong">{t('ai.preview.day', { number, name: programDayName(t, day.name) })}</span>
      <span className="shrink-0 text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{dayDetail(t, day, true)}</span>
    </button>
  )
}

function OpenDay({ day, number, onToggle }: { day: PreviewDay; number: number; onToggle: () => void }) {
  const { t, fmt } = useI18n()
  return (
    <div className={cn(surfaceClass, 'flex flex-col gap-1 rounded-lg px-3.5 pt-1 pb-3')}>
      <button type="button" aria-expanded onClick={onToggle} className={cn('-mx-3.5 flex min-h-touch flex-col justify-center px-3.5 py-1 text-left', focusRing)}>
        <span className="type-body-strong">{t('ai.preview.day', { number, name: programDayName(t, day.name) })}</span>
        <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{dayDetail(t, day, false)}</span>
      </button>
      <ul className="flex flex-col">
        {day.slots.map((slot, index) => (
          <li key={index} className={cn('flex min-h-[30px] items-center gap-2.5 py-0.5 type-body', slot.check && '-mx-2 rounded-sm bg-insight px-2')}>
            {slot.check ? <Icon name="pyetje" size={18} /> : <Icon name="zgjedhur" size={18} label={t('ai.preview.knownIcon')} className="text-success" />}
            <span lang="en" className="line-clamp-2 min-w-0 flex-1">
              {slot.pdfName ? t('ai.preview.quoted', { name: slot.name }) : slot.name}
            </span>
            {slot.check ? (
              <span className="shrink-0 font-semibold">{t('ai.preview.check')}</span>
            ) : (
              <span className="shrink-0 text-muted-foreground tabular-nums">{`${fmt.number(slot.sets)} × ${prescriptionValue(t, fmt, slot.prescription)}`}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
