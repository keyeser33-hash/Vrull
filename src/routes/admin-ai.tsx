import { useCallback, useEffect, useId, useState } from 'react'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { type AdminError, type AdminPerson, stepLimit } from '@/data/ai-admin'
import { aiAdminRemote } from '@/data/app-data'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/use-online'

// Cilësimet › Admini › Kufiri i AI-së (V42, V2-E2-17; bordi V22-Admin-Kufiri): kostoja e muajit për çdo
// person sipas veçorisë dhe kufiri me −/+ 5 €; "Ruaj ndryshimet" i dërgon te funksioni ai-admin. Vetëm me
// internet: lista vjen nga serveri, jo nga telefoni.

type State = { kind: 'loading' } | { kind: 'error'; error: AdminError } | { kind: 'ready'; month: string; people: AdminPerson[] }

export function AdminAiPage() {
  const { t } = useI18n()
  const online = useOnline()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const result = await aiAdminRemote.list()
    setState(result.ok ? { kind: 'ready', month: result.month, people: result.people } : { kind: 'error', error: result.error })
  }, [])
  useEffect(() => {
    let active = true
    void aiAdminRemote.list().then((result) => {
      if (active) setState(result.ok ? { kind: 'ready', month: result.month, people: result.people } : { kind: 'error', error: result.error })
    })
    return () => {
      active = false
    }
  }, [online])

  const people = state.kind === 'ready' ? state.people : []
  const changed = people.filter((person) => limits[person.id] !== undefined && limits[person.id] !== person.limitEur)

  async function save() {
    setSaving(true)
    let result = null
    for (const person of changed) result = await aiAdminRemote.setLimit(person.id, limits[person.id])
    setSaving(false)
    if (result?.ok) {
      setLimits({})
      setState({ kind: 'ready', month: result.month, people: result.people })
    } else if (result) setState({ kind: 'error', error: result.error })
  }

  const owner = people.find((person) => person.isAdmin)
  const friends = people.filter((person) => !person.isAdmin)
  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={t('admin.ai.title')} back={t('admin.ai.back')} fallback="/cilesimet" />
      {state.kind === 'loading' ? <div aria-hidden className="h-[320px] rounded-xl bg-surface" /> : null}
      {state.kind === 'error' ? (
        <div role="alert" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4')}>
          <p className="m-0 flex gap-2.5 type-body-l">
            {state.error === 'offline' ? <Icon name="pa-internet" size={20} className="mt-0.5 shrink-0" /> : null}
            {t(state.error === 'offline' ? 'admin.ai.offline' : state.error === 'forbidden' ? 'admin.ai.forbidden' : 'admin.ai.failed')}
          </p>
          {state.error === 'failed' ? (
            <Button variant="secondary" className="self-start" onClick={() => void load()}>
              {t('admin.ai.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <MonthNote month={state.month} />
          {owner ? <PersonCard person={owner} limit={limits[owner.id] ?? owner.limitEur} title={t('admin.ai.owner')} detailed onLimit={(value) => setLimits({ ...limits, [owner.id]: value })} month={state.month} /> : null}
          <section className="flex flex-col gap-2">
            <h2 className="px-1 type-label text-muted-foreground">{t('admin.ai.friends')}</h2>
            {friends.length === 0 ? <p className="m-0 px-1 type-body text-muted-foreground">{t('admin.ai.none')}</p> : null}
            {friends.map((person) => (
              <PersonCard key={person.id} person={person} limit={limits[person.id] ?? person.limitEur} title={person.name} onLimit={(value) => setLimits({ ...limits, [person.id]: value })} month={state.month} />
            ))}
          </section>
          <div className="flex flex-col gap-2 pt-1">
            <Button variant="primary" size="xl" disabled={changed.length === 0 || saving || !online} onClick={() => void save()}>
              {t('admin.ai.save')}
            </Button>
            <span className="text-center type-caption text-muted-foreground">{t('admin.ai.footer')}</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Dita e parë e muajit tjetër, kur kufiri rinis (ora e Tiranës te serveri). */
const nextMonth = (month: string) => {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index, 1, 12)
}

function MonthNote({ month }: { month: string }) {
  const { t, fmt } = useI18n()
  return (
    <div className="flex flex-col gap-1">
      <span className="type-display-s">{t('admin.ai.month')}</span>
      <span className="type-body text-muted-foreground">{t('admin.ai.note', { date: fmt.date(nextMonth(month), { weekday: false }) })}</span>
    </div>
  )
}

function PersonCard({
  person,
  limit,
  title,
  detailed = false,
  month,
  onLimit,
}: {
  person: AdminPerson
  limit: number
  title: string
  detailed?: boolean
  month: string
  onLimit: (limit: number) => void
}) {
  const { t, fmt } = useI18n()
  const titleId = useId()
  const limitId = useId()
  const euro = (value: number) => fmt.unit(value, '€', { minDigits: 2, maxDigits: 2 })
  const whole = (value: number) => fmt.unit(value, '€', { maxDigits: 2 })
  const reached = person.spentEur >= person.limitEur
  const rows = [
    { label: t('admin.ai.box'), detail: t('admin.ai.boxCount', { count: person.byFeature.food_text.count }), eur: person.byFeature.food_text.eur },
    { label: t('admin.ai.photo'), detail: t('admin.ai.photoCount', { count: person.byFeature.food_photo.count }), eur: person.byFeature.food_photo.eur },
    { label: t('admin.ai.label'), detail: null, eur: person.byFeature.supplement_label.eur },
    { label: t('admin.ai.pdf'), detail: null, eur: person.byFeature.program_pdf.eur },
  ]
  return (
    <section aria-labelledby={titleId} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4', reached && 'border-subtle')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className={detailed ? 'type-title' : 'type-body-strong'}>
          {title}
        </h2>
        <span className="type-body tabular-nums">
          <strong className="font-bold">{euro(person.spentEur)}</strong> <span className="text-muted-foreground">{t('admin.ai.ofLimit', { limit: whole(person.limitEur) })}</span>
        </span>
      </div>
      <span role="meter" aria-label={t('admin.ai.usage', { name: title })} aria-valuemin={0} aria-valuemax={person.limitEur} aria-valuenow={person.spentEur} aria-valuetext={t('admin.ai.of', { spent: euro(person.spentEur), limit: whole(person.limitEur) })}>
        <ProgressTrack ratio={person.limitEur > 0 ? person.spentEur / person.limitEur : 1} tone="data" />
      </span>
      {detailed ? (
        <ul className="m-0 list-none p-0 type-body tabular-nums">
          {rows.map((row) => (
            <li key={row.label} className="flex min-h-touch items-center gap-3 border-t border-border">
              <span className="min-w-0 flex-1">
                {row.label}
                {row.detail ? <span className="text-muted-foreground">{` · ${row.detail}`}</span> : null}
              </span>
              <span className={row.eur ? undefined : 'text-muted-foreground'}>{euro(row.eur)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {reached ? (
        <p className="m-0 flex gap-2 type-body">
          <Icon name="kyc" size={18} className="mt-0.5 shrink-0" />
          {t('admin.ai.reached', { date: fmt.date(nextMonth(month), { weekday: false }) })}
        </p>
      ) : null}
      <div className={cn('flex items-center gap-3', detailed && 'border-t border-border pt-3')}>
        <span id={limitId} className={detailed ? 'min-w-0 flex-1 type-body-strong' : 'min-w-0 flex-1 type-caption text-muted-foreground'}>
          {t('admin.ai.limit')}
        </span>
        <div role="group" aria-labelledby={limitId} className="flex items-center rounded-md border border-subtle">
          <Button variant="ghost" size="icon" aria-label={t('admin.ai.less', { name: title })} disabled={limit <= 0} onClick={() => onLimit(stepLimit(limit, -1))}>
            <span aria-hidden className="text-2xl">−</span>
          </Button>
          <output className="min-w-14 text-center font-display text-2xl font-extrabold tabular-nums">{whole(limit)}</output>
          <Button variant="ghost" size="icon" aria-label={t('admin.ai.more', { name: title })} onClick={() => onLimit(stepLimit(limit, 1))}>
            <Icon name="plus" size={20} />
          </Button>
        </div>
      </div>
    </section>
  )
}
