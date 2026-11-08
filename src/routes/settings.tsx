import { useEffect, useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { DayPicker } from '@/components/forms/day-picker'
import { TimeStepper } from '@/components/forms/time-stepper'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Group, LinkRow, Row, rowClass } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import {
  auth,
  scheduler,
  store,
  updater,
  updatesSupported,
  useAppUpdate,
  useLocalQuery,
  usePendingChanges,
  useSyncStatus,
} from '@/data/app-data'
import { parseWeight, type Profile, readProfile, updateProfile } from '@/data/profile'
import { reminderSettings } from '@/data/reminders'
import { shareExport } from '@/data/share-export'
import { syncSummary } from '@/data/sync-status-text'
import { LANGUAGE_NAMES } from '@/i18n/language'
import { useI18n } from '@/i18n/use-i18n'
import { useBackground } from '@/lib/background'
import { cn } from '@/lib/cn'
import { batteryUnrestricted, requestBatteryExemption } from '@/lib/rest-alarm'
import { readTheme } from '@/lib/theme'
import type { ReminderToggles } from '@/reminders/plan'
import { UpdateSheet } from './app-update'
import { versionRowDetail } from './update-format'

// Cilësimet (bordi "Cilësimet", V2-E1-05): Profili, Pamja, Njoftimet, Sinkronizimi, Versioni dhe
// "Dil" në fund. Seksionet e etapave të tjera (AI, ora dhe Health Connect, Admini) mungojnë deri
// atëherë. Një rresht hap një fletë (?ndrysho=...), që butoni mbrapa i Android-it e mbyll, ose një
// ekran (Pamja, Rikujtuesit).

type ProfileEditor = 'pesha' | 'dite' | 'oraret'
type Editor = ProfileEditor | 'dil' | 'burimet' | 'perditesimi'
const isProfileEditor = (value: Editor | null): value is ProfileEditor => value === 'pesha' || value === 'dite' || value === 'oraret'

// Radha e bordit: "Stërvitja, vaktet, suplementet, matjet".
const REMINDER_ORDER: (keyof ReminderToggles)[] = ['training', 'meals', 'supplements', 'measurements']

export function SettingsPage() {
  const { t, fmt, lang } = useI18n()
  const profile = useLocalQuery(() => readProfile(store), [])
  const reminders = useLocalQuery(() => reminderSettings(store), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [theme] = useState(readTheme)
  const background = useBackground()
  const editor = params.get('ndrysho') as Editor | null
  const open = (name: Editor) => setParams({ ndrysho: name })
  const close = () => navigate(-1)

  const days = profile ? [...profile.trainingDays].sort((a, b) => a - b).map((day) => t(`day.short.${day}` as 'day.short.1')).join(', ') : ''
  const enabled = reminders ? REMINDER_ORDER.filter((key) => reminders.toggles[key]).map((key) => t(`reminders.list.${key}`)) : []
  const remindersDetail = enabled.length ? capitalize(enabled.join(', ')) : t('settings.remindersOff')

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('settings.title')} back={t('common.back')} />

      {profile ? (
        <Group title={t('settings.profile')}>
          <Row
            label={t('settings.weightToday')}
            value={profile.weightKg === null ? t('settings.noWeight') : fmt.unit(profile.weightKg, 'kg', { minDigits: 1, maxDigits: 1 })}
            onClick={() => open('pesha')}
          />
          <Row label={t('settings.trainingDays')} value={days} onClick={() => open('dite')} />
          <Row
            label={t('settings.schedule')}
            detail={t('settings.scheduleDetail', { training: profile.trainingTime, wake: profile.wakeTime, sleep: profile.sleepTime })}
            ariaLabel={`${t('settings.schedule')}, ${t('settings.scheduleDetail', { training: profile.trainingTime, wake: profile.wakeTime, sleep: profile.sleepTime })}`}
            onClick={() => open('oraret')}
          />
        </Group>
      ) : (
        <div aria-hidden className="h-52 rounded-lg bg-surface" />
      )}

      <Group title={t('settings.appearance')}>
        <LinkRow to="/cilesimet/pamja" label={t('settings.theme')} value={t(`settings.theme.${theme}`)} ariaLabel={`${t('settings.theme')}, ${t(`settings.theme.${theme}`)}`} />
        <LinkRow
          to="/cilesimet/pamja"
          label={t('settings.background')}
          value={t(`settings.background.${background}`)}
          ariaLabel={`${t('settings.background')}, ${t(`settings.background.${background}`)}`}
        />
        <LinkRow to="/cilesimet/pamja" label={t('settings.language')} value={LANGUAGE_NAMES[lang]} ariaLabel={`${t('settings.language')}, ${LANGUAGE_NAMES[lang]}`} />
      </Group>

      <Group title={t('settings.notifications')}>
        <LinkRow to="/cilesimet/rikujtuesit" label={t('settings.reminders')} detail={reminders ? remindersDetail : undefined} />
        <TimerRow />
      </Group>

      <SyncGroup />

      <VersionGroup onOpenUpdate={() => open('perditesimi')} onOpenSources={() => open('burimet')} />

      <div className="flex flex-col gap-2 pt-1">
        <Button variant="outline" size="lg" className="w-full" onClick={() => open('dil')}>
          {t('settings.signOut')}
        </Button>
        <p className="text-center type-caption text-muted-foreground">{t('settings.signOutNote')}</p>
      </div>

      {editor === 'dil' ? <SignOutSheet onClose={close} /> : null}
      {editor === 'burimet' ? <SourcesSheet onClose={close} /> : null}
      {editor === 'perditesimi' ? <UpdateSheet onClose={close} /> : null}
      {profile && isProfileEditor(editor) ? <ProfileSheet editor={editor} profile={profile} onClose={close} /> : null}
    </div>
  )
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** Vetëm në telefon: përjashtimi nga optimizimi i baterisë, kur timer-i vonon me ekran të kyçur. */
function TimerRow() {
  const { t } = useI18n()
  const [unrestricted, setUnrestricted] = useState<boolean | null>(null)
  useEffect(() => {
    const check = () => void batteryUnrestricted().then(setUnrestricted)
    check()
    // Pas dritares së sistemit, app-i kthehet në plan të parë: gjendja lexohet përsëri.
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  if (unrestricted === null) return null
  return (
    <Row
      label={t('settings.restTimer')}
      value={t(unrestricted ? 'settings.batteryUnrestricted' : 'settings.removeBatteryLimit')}
      onClick={() => void requestBatteryExemption()}
      disabled={unrestricted}
      action
    />
  )
}

const DOT = { success: 'bg-success', muted: 'bg-muted-foreground', danger: 'bg-danger' } as const
const TONE = { success: 'text-success', muted: 'text-foreground', danger: 'text-danger' } as const

function SyncGroup() {
  const i18n = useI18n()
  const { t } = i18n
  const status = useSyncStatus()
  const pending = usePendingChanges()
  const [now, setNow] = useState(() => new Date())
  const [exporting, setExporting] = useState(false)
  const [problem, setProblem] = useState(false)
  // Koha relative ("para 5 min") rifreskohet vetë.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const summary = syncSummary(status, now, i18n)

  async function exportData() {
    setExporting(true)
    setProblem(false)
    try {
      await shareExport()
    } catch {
      setProblem(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Group title={t('settings.sync')}>
      <div className={cn(rowClass, 'min-h-16 py-2.5')}>
        <div role="status" className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('flex items-center gap-2 type-body-strong', TONE[summary.tone])}>
            <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', DOT[summary.tone])} />
            {summary.title}
          </span>
          {summary.detail ? <span className="type-caption text-muted-foreground">{summary.detail}</span> : null}
          {pending > 0 ? <span className="type-caption text-muted-foreground tabular-nums">{t('sync.pending', { count: pending })}</span> : null}
        </div>
        <Button variant="outline" className="shrink-0" disabled={status.syncing} onClick={() => void scheduler.syncNow()}>
          {t('settings.syncNow')}
        </Button>
      </div>
      <Row
        label={exporting ? t('settings.exporting') : t('settings.export')}
        ariaLabel={exporting ? t('settings.exporting') : t('settings.export')}
        detail={t('settings.exportHint')}
        value="JSON"
        disabled={exporting}
        onClick={() => void exportData()}
      />
      {problem ? (
        <p role="alert" className="border-t border-border px-4 py-3 type-caption text-danger">
          {t('settings.exportFailed')}
        </p>
      ) : null}
    </Group>
  )
}

function VersionGroup({ onOpenUpdate, onOpenSources }: { onOpenUpdate: () => void; onOpenSources: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const state = useAppUpdate()
  const supported = updatesSupported()
  const name = t('settings.appVersion', { version: __APP_VERSION__ })
  const detail = supported ? (versionRowDetail(state, i18n) ?? t('settings.checksItself')) : null
  const release = 'release' in state ? state.release : undefined
  return (
    <Group title={t('settings.version')}>
      {supported && release ? (
        <Row label={name} detail={detail} ariaLabel={`${name}, ${detail}`} onClick={onOpenUpdate} />
      ) : (
        <div className={cn(rowClass, 'min-h-16 py-2.5')}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-body-strong tabular-nums">{name}</span>
            {detail ? <span className="type-caption text-muted-foreground">{detail}</span> : null}
          </span>
          {supported ? (
            <Button variant="outline" className="shrink-0" disabled={state.status === 'checking'} onClick={() => void updater.check({ force: true })}>
              {t('update.checkNow')}
            </Button>
          ) : null}
        </div>
      )}
      <Row label={t('settings.sources')} onClick={onOpenSources} />
    </Group>
  )
}

function SignOutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const pending = usePendingChanges()
  return (
    <Sheet title={t('common.signOut')} onClose={onClose}>
      <p className="type-body text-muted-foreground">
        {t('settings.signOutText')}
        {pending > 0 ? ` ${t('settings.signOutPending')}` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="outline" size="lg" onClick={() => void auth.signOut()}>
          {t('common.signOut')}
        </Button>
      </div>
    </Sheet>
  )
}

// Të dhënat dhe asetet nga të tjerët, me atribuimin që kërkon licenca e tyre (SPEC §11, §9).
const SOURCES = [
  { id: 'program', name: 'Shortcut to Size' },
  { id: 'anatomy', name: 'BodyParts3D' },
  { id: 'exercises', name: 'free-exercise-db' },
  { id: 'off', name: 'Open Food Facts' },
  { id: 'usda', name: 'USDA FoodData Central' },
  { id: 'fonts', name: 'Barlow, Barlow Condensed' },
] as const

function SourcesSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet title={t('settings.sources')} onClose={onClose}>
      <ul className="flex flex-col">
        {SOURCES.map((source) => (
          <li key={source.id} className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0">
            <span className="type-body-strong">{source.name}</span>
            <span className="type-body">{t(`sources.${source.id}.use`)}</span>
            <span className="type-caption text-muted-foreground">{t(`sources.${source.id}.license`)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

const SHEET_TITLES = { pesha: 'settings.weightToday', dite: 'settings.trainingDays', oraret: 'settings.schedule' } as const

/** Një vlerë e profilit në fletë; ruhet vetëm me "Ruaj", që një prekje e gabuar të mos ndryshojë asgjë. */
function ProfileSheet({ editor, profile, onClose }: { editor: ProfileEditor; profile: Profile; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const daysLabel = useId()
  const errorId = useId()
  const kg = (value: number) => fmt.number(value, { maxDigits: 2 })
  const [days, setDays] = useState(profile.trainingDays)
  const [times, setTimes] = useState({ trainingTime: profile.trainingTime, wakeTime: profile.wakeTime, sleepTime: profile.sleepTime })
  const [weight, setWeight] = useState<number | null>(profile.weightKg)
  const [weightText, setWeightText] = useState(profile.weightKg === null ? '' : kg(profile.weightKg))
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const setWeightValue = (value: number) => {
    const rounded = Math.round(value * 100) / 100
    setWeight(rounded)
    setWeightText(kg(rounded))
    setProblem(null)
  }

  async function save() {
    let patch: Partial<Profile>
    if (editor === 'pesha') {
      const value = weight === null ? null : parseWeight(String(weight))
      if (value === null) return setProblem(t('profile.weightInvalid'))
      patch = { weightKg: value }
    } else if (editor === 'dite') {
      if (days.length === 0) return setProblem(t('profile.daysInvalid'))
      patch = { trainingDays: days }
    } else {
      patch = times
    }
    setBusy(true)
    try {
      await updateProfile(store, patch)
      onClose()
    } catch {
      setProblem(t('profile.saveFailed'))
      setBusy(false)
    }
  }

  const footer = (
    <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
      {t('common.save')}
    </Button>
  )
  return (
    <Sheet title={t(SHEET_TITLES[editor])} onClose={onClose} footer={footer}>
      {editor === 'pesha' ? (
        <>
          <ValueStepper
            variant="hero"
            hideLabel
            label={t('profile.weight')}
            text={weightText}
            unit="kg"
            placeholder={kg(80.5)}
            inputMode="decimal"
            minusLabel={t('ui.stepper.lowerWeight', { step: 0.5 })}
            plusLabel={t('ui.stepper.raiseWeight', { step: 0.5 })}
            onMinus={() => setWeightValue((weight ?? 80) - 0.5)}
            onPlus={() => setWeightValue((weight ?? 80) + 0.5)}
            onCommit={(text) => {
              const parsed = Number(text.trim().replace(',', '.'))
              if (text.trim() && Number.isFinite(parsed)) setWeightValue(parsed)
            }}
            invalid={Boolean(problem)}
            describedBy={problem ? errorId : undefined}
          />
          <p className="text-center type-caption text-muted-foreground">{t('profile.weightSaved')}</p>
        </>
      ) : editor === 'dite' ? (
        <div className="flex flex-col gap-1.5">
          <p id={daysLabel} className="sr-only">
            {t('settings.trainingDays')}
          </p>
          <DayPicker value={days} onChange={(next) => (setDays(next), setProblem(null))} labelledBy={daysLabel} />
          <p className="type-caption text-muted-foreground">{t('profile.daysHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(
            [
              ['trainingTime', 'profile.trainingTime'],
              ['wakeTime', 'profile.wake'],
              ['sleepTime', 'profile.sleep'],
            ] as const
          ).map(([key, label]) => (
            <TimeStepper
              key={key}
              variant="row"
              label={t(label)}
              short={t(label)}
              value={times[key]}
              onChange={(value) => setTimes((current) => ({ ...current, [key]: value }))}
            />
          ))}
        </div>
      )}
      {problem ? (
        <p id={errorId} role="alert" className="flex items-center gap-2 type-caption text-danger">
          <Icon name="paralajmerim" size={18} />
          {problem}
        </p>
      ) : null}
    </Sheet>
  )
}
