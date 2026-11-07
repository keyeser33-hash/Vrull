import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Choice } from '@/components/forms/choice'
import { DayPicker } from '@/components/forms/day-picker'
import { TimeStepper } from '@/components/forms/time-stepper'
import { ValueStepper } from '@/components/forms/value-stepper'
import { WEEK_DAYS } from '@/components/forms/week-days'
import { Group, Row, SwitchRow } from '@/components/layout/list-group'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { auth, planRemindersNow, scheduler, store, useAuth, useLocalQuery, usePendingChanges, useSyncStatus } from '@/data/app-data'
import { parseWeight, type Profile, readProfile, updateProfile } from '@/data/profile'
import { reminderSettings, setMeasurementDay, setReminderToggle } from '@/data/reminders'
import { shareExport } from '@/data/share-export'
import { describeSync } from '@/data/sync-status-text'
import { reminderPermission, type ReminderPermission, requestReminderPermission } from '@/lib/reminders-native'
import { batteryUnrestricted, requestBatteryExemption } from '@/lib/rest-alarm'
import { readTheme, saveTheme, THEME_LABELS, THEMES, type Theme } from '@/lib/theme'
import { kg } from './training-format'

// Cilësimet, varianti A i aprovuar më 07.11.2026 (referencat nga Mobbin: Tempo, Hevy, Google
// Health): sipër paneli i llogarisë me "Dil"; poshtë grupe rreshtash me vlerën e tanishme. Një
// rresht hap një fletë (?ndrysho=...), që butoni mbrapa i Android-it e mbyll.

type ProfileEditor = 'dite' | 'ora' | 'pesha' | 'zgjimi' | 'gjumi'
type Editor = ProfileEditor | 'tema' | 'dil' | 'matja'
const isProfileEditor = (value: Editor | null): value is ProfileEditor =>
  value === 'dite' || value === 'ora' || value === 'pesha' || value === 'zgjimi' || value === 'gjumi'

const shortDays = (days: number[]) =>
  [...days]
    .sort((a, b) => a - b)
    .map((day) => WEEK_DAYS.find((entry) => entry.value === day)?.short)
    .join(', ')

export function SettingsPage() {
  const profile = useLocalQuery(() => readProfile(store), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const editor = params.get('ndrysho') as Editor | null
  const open = (name: Editor) => setParams({ ndrysho: name })
  const close = () => navigate(-1)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Cilësimet</h1>
        <Link to="/" aria-label="Kthehu te Sot" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <Icon name="mbyll" size={22} />
        </Link>
      </header>

      <AccountPanel onSignOut={() => open('dil')} />

      {profile ? (
        <>
          <Group title="Stërvitja">
            <Row label="Ditët e stërvitjes" value={shortDays(profile.trainingDays)} onClick={() => open('dite')} />
            <Row label="Ora e stërvitjes" value={profile.trainingTime} onClick={() => open('ora')} />
          </Group>
          <Group title="Ti">
            <Row label="Pesha e sotme" value={profile.weightKg === null ? 'Pa peshë' : `${kg(profile.weightKg)} kg`} onClick={() => open('pesha')} />
            <Row label="Zgjimi" value={profile.wakeTime} onClick={() => open('zgjimi')} />
            <Row label="Gjumi" value={profile.sleepTime} onClick={() => open('gjumi')} />
          </Group>
        </>
      ) : (
        <div aria-hidden className="h-72 rounded-xl bg-skeleton" />
      )}

      <Group title="App-i">
        <Row label="Tema" value={THEME_LABELS[theme]} onClick={() => open('tema')} />
        <TimerRow />
      </Group>

      <RemindersGroup onPickDay={() => open('matja')} />

      <DataGroup />

      <p className="text-xs leading-4 text-muted-foreground">Training Hub {__APP_VERSION__}</p>

      {editor === 'dil' ? <SignOutSheet onClose={close} /> : null}
      {editor === 'matja' ? <MeasurementDaySheet onClose={close} /> : null}
      {editor === 'tema' ? (
        <ThemeSheet
          theme={theme}
          onChoose={(next) => {
            setTheme(next)
            saveTheme(next)
          }}
          onClose={close}
        />
      ) : null}
      {profile && isProfileEditor(editor) ? <ProfileSheet editor={editor} profile={profile} onClose={close} /> : null}
    </div>
  )
}

function AccountPanel({ onSignOut }: { onSignOut: () => void }) {
  const session = useAuth()
  const status = useSyncStatus()
  const pending = usePendingChanges()
  const [, setTick] = useState(0)
  // Koha relative ("para 5 min") rifreskohet vetë.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  const initial = (session.email ?? '?').charAt(0).toUpperCase()
  return (
    <section aria-label="Llogaria" className="flex flex-col gap-4 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-panel-button text-lg font-semibold">
          {initial}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base leading-6 font-semibold">{session.email ?? 'Pa llogari'}</span>
          <span role="status" className="text-sm leading-5 text-panel-muted-foreground">
            {describeSync(status)}
          </span>
        </div>
        <Button variant="panel" className="shrink-0" onClick={onSignOut}>
          Dil
        </Button>
      </div>
      {pending > 0 ? (
        <p className="text-sm leading-5 text-panel-muted-foreground tabular-nums">
          {pending === 1 ? '1 ndryshim pret dërgimin' : `${pending} ndryshime presin dërgimin`}
        </p>
      ) : null}
    </section>
  )
}

/** Vetëm në telefon: përjashtimi nga optimizimi i baterisë, kur timer-i vonon me ekran të kyçur. */
function TimerRow() {
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
      label="Timer-i i pushimit"
      value={unrestricted ? 'Bateria pa kufizime' : 'Hiq kufizimin e baterisë'}
      onClick={() => void requestBatteryExemption()}
      disabled={unrestricted}
      action
    />
  )
}

function DataGroup() {
  const status = useSyncStatus()
  const [exporting, setExporting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function exportData() {
    setExporting(true)
    setProblem(null)
    try {
      await shareExport()
    } catch {
      setProblem('Eksporti nuk u krye. Provo përsëri.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Group title="Të dhënat">
      <Row label="Sinkronizo tani" action onClick={() => void scheduler.syncNow()} disabled={status.syncing} />
      <Row label={exporting ? 'Po përgatitet' : 'Eksporto të dhënat'} action onClick={() => void exportData()} disabled={exporting} />
      <p className="border-t border-border-subtle px-4 py-3 text-xs leading-4 text-muted-foreground">
        Kopja JSON përmban çdo tabelë, pa fotot. Ruaje diku jashtë telefonit.
      </p>
      {problem ? (
        <p role="alert" className="px-4 pb-3 text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
    </Group>
  )
}

function SignOutSheet({ onClose }: { onClose: () => void }) {
  const pending = usePendingChanges()
  return (
    <Sheet title="Dil nga llogaria" onClose={onClose}>
      <p className="text-base leading-6 text-muted-foreground">
        Të dhënat mbeten në telefon. Për të hyrë përsëri duhet internet.
        {pending > 0 ? ' Ndryshimet që presin dërgohen pasi të hysh.' : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onClose}>
          Anulo
        </Button>
        <Button variant="outline" onClick={() => void auth.signOut()}>
          Dil nga llogaria
        </Button>
      </div>
    </Sheet>
  )
}

function ThemeSheet({ theme, onChoose, onClose }: { theme: Theme; onChoose: (theme: Theme) => void; onClose: () => void }) {
  return (
    <Sheet title="Tema" onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm leading-5 text-muted-foreground">
          OLED përdor të zezë të plotë dhe kursen bateri në ekranet OLED.
        </legend>
        {THEMES.map((option) => (
          <Choice key={option} name="theme" value={option} checked={theme === option} onChange={() => onChoose(option)} label={THEME_LABELS[option]} />
        ))}
      </fieldset>
    </Sheet>
  )
}

const SHEET_TITLES: Record<ProfileEditor, string> = {
  dite: 'Ditët e stërvitjes',
  ora: 'Ora e stërvitjes',
  pesha: 'Pesha e sotme',
  zgjimi: 'Zgjimi',
  gjumi: 'Gjumi',
}

/** Një vlerë e profilit në fletë; ruhet vetëm me "Ruaj", që një prekje e gabuar të mos ndryshojë asgjë. */
function ProfileSheet({ editor, profile, onClose }: { editor: ProfileEditor; profile: Profile; onClose: () => void }) {
  const daysLabel = useId()
  const errorId = useId()
  const [days, setDays] = useState(profile.trainingDays)
  const [time, setTime] = useState(
    editor === 'ora' ? profile.trainingTime : editor === 'zgjimi' ? profile.wakeTime : profile.sleepTime,
  )
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
      if (value === null) return setProblem('Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.')
      patch = { weightKg: value }
    } else if (editor === 'dite') {
      if (days.length === 0) return setProblem('Zgjidh të paktën një ditë stërvitjeje.')
      patch = { trainingDays: days }
    } else {
      patch = { [editor === 'ora' ? 'trainingTime' : editor === 'zgjimi' ? 'wakeTime' : 'sleepTime']: time }
    }
    setBusy(true)
    try {
      await updateProfile(store, patch)
      onClose()
    } catch {
      setProblem('Ndryshimi nuk u ruajt. Provo përsëri.')
      setBusy(false)
    }
  }

  const title = SHEET_TITLES[editor]
  return (
    <Sheet title={title} onClose={onClose}>
      {editor === 'pesha' ? (
        <>
          <ValueStepper
            variant="hero"
            hideLabel
            label="Pesha"
            text={weightText}
            unit="kg"
            placeholder="80,5"
            inputMode="decimal"
            minusLabel="Ul peshën me 0,5 kg"
            plusLabel="Rrit peshën me 0,5 kg"
            onMinus={() => setWeightValue((weight ?? 80) - 0.5)}
            onPlus={() => setWeightValue((weight ?? 80) + 0.5)}
            onCommit={(text) => {
              const parsed = Number(text.trim().replace(',', '.'))
              if (text.trim() && Number.isFinite(parsed)) setWeightValue(parsed)
            }}
            invalid={Boolean(problem)}
            describedBy={problem ? errorId : undefined}
          />
          <p className="text-center text-sm leading-5 text-muted-foreground">Ruhet si matja e sotme. Historia e peshës shfaqet te Progresi.</p>
        </>
      ) : editor === 'dite' ? (
        <div>
          <p id={daysLabel} className="mb-1.5 text-sm leading-5 font-medium">
            Ditët e stërvitjes
          </p>
          <DayPicker value={days} onChange={(next) => (setDays(next), setProblem(null))} labelledBy={daysLabel} />
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">Radha e programit nuk ndryshon: ecën kur mbyll një stërvitje.</p>
        </div>
      ) : (
        <TimeStepper label={title} short={title} value={time} onChange={setTime} hideLabel />
      )}
      {problem ? (
        <p id={errorId} role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <Button className="w-full" disabled={busy} onClick={() => void save()}>
        Ruaj
      </Button>
    </Sheet>
  )
}

const TOGGLES = [
  { key: 'meals', label: 'Vaktet', detail: 'Në orën e çdo vakti, me artikujt e planit' },
  { key: 'supplements', label: 'Suplementet', detail: 'Bashkë me vaktin ku merren' },
  { key: 'training', label: 'Stërvitja', detail: 'Në mëngjes, stërvitja e radhës' },
  { key: 'measurements', label: 'Matja javore', detail: 'Pesha, perimetrat dhe fotot' },
] as const

/** Rikujtuesit (SPEC §13): çka njofton telefoni, dita e matjes dhe leja e njoftimeve. */
function RemindersGroup({ onPickDay }: { onPickDay: () => void }) {
  const settings = useLocalQuery(() => reminderSettings(store), [])
  const [permission, setPermission] = useState<ReminderPermission | null>(null)
  useEffect(() => {
    const check = () => void reminderPermission().then(setPermission)
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  if (!settings) return null
  const day = WEEK_DAYS.find((entry) => entry.value === settings.measurementDay)?.name ?? 'E diel'
  return (
    <Group title="Rikujtuesit">
      {permission === 'prompt' || permission === 'denied' ? (
        <Row
          label="Lejo njoftimet"
          detail={permission === 'denied' ? 'Lejoji te cilësimet e telefonit për Training Hub' : 'Pa leje, rikujtuesit nuk vijnë'}
          onClick={() =>
            void requestReminderPermission().then(async (granted) => {
              setPermission(granted ? 'granted' : await reminderPermission())
              if (granted) await planRemindersNow()
            })
          }
          action
        />
      ) : null}
      {TOGGLES.map((toggle) => (
        <SwitchRow
          key={toggle.key}
          label={toggle.label}
          detail={toggle.detail}
          checked={settings.toggles[toggle.key]}
          onChange={(on) => void setReminderToggle(store, toggle.key, on)}
        />
      ))}
      <Row label="Dita e matjes" value={day} onClick={onPickDay} />
    </Group>
  )
}

function MeasurementDaySheet({ onClose }: { onClose: () => void }) {
  const settings = useLocalQuery(() => reminderSettings(store), [])
  return (
    <Sheet title="Dita e matjes" onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm leading-5 text-muted-foreground">Rikujtuesi vjen në orën e zgjimit, që pesha të matet para mëngjesit.</legend>
        {WEEK_DAYS.map((entry) => (
          <Choice
            key={entry.value}
            name="measurement-day"
            value={String(entry.value)}
            checked={settings?.measurementDay === entry.value}
            onChange={() => void setMeasurementDay(store, entry.value).then(onClose)}
            label={entry.name}
          />
        ))}
      </fieldset>
    </Sheet>
  )
}
